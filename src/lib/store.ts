import {
  commandError,
  type CommandResult,
  type DomainCommand,
  type IssuePatch,
} from './commands'
import { CommandSystem } from './command-system'
import { astFromFilters } from './filter-ast'
import { splitInbox, markAllRead, defaultDeliveryPreferences, type DeliveryPreferences, type InboxNotification } from './inbox'
import {
  classifyCycles,
  normalizeCycle,
  normalizeMilestone,
  normalizeProject,
  rolloverCycle,
} from './planning'
import {
  applyTriageRules,
  isSnoozed,
  mergeSupportLinks,
  snoozeUntil,
  type CustomerRequest,
  type TriageRule,
} from './triage'
import { applyExtraFilters, boardColumns, currentCycle, filterIssues, fuzzyMatch } from './filters'
import { formatIdentifier } from './identifiers'
import { cloneIssue, normalizeIssue, pickInverse } from './issue-model'
import { MemoryPersistence, type Persistence } from './persist'
import { createWorkspaceSnapshot } from './seed-roadmap'
import { IDS } from './seed'
import { ImmediateAckBackend, SyncEngine, tryGraphqlBackend, type SyncBackend } from './sync'
import { GraphQLSyncBackend } from './sync/graphql-backend'
import { attachGraphqlRealtime, type RealtimeClient } from './sync/realtime'
import type {
  BoardDrag,
  CollectionRestore,
  CreateIssueInput,
  Cycle,
  DisplayProperty,
  GroupBy,
  Initiative,
  InversePatch,
  Issue,
  IssueActivity,
  IssueComment,
  IssueFilters,
  IssueLink,
  Label,
  Layout,
  Milestone,
  OrderBy,
  OverlayId,
  PlanningDocument,
  Priority,
  Project,
  ProjectUpdate,
  PropertyMenuKind,
  SavedView,
  Snapshot,
  Team,
  UiState,
  User,
  ViewId,
  ViewQuery,
  WorkflowState,
  Workspace,
} from './types'
import { DEFAULT_DISPLAY_PROPERTIES, EMPTY_AST, EMPTY_FILTERS } from './types'

function defaultUi(snapshot: Snapshot): UiState {
  const team = snapshot.teams[0]
  const defaultState =
    snapshot.states.find((state) => state.isDefault && state.teamId === team.id) ??
    snapshot.states[0]
  return {
    highlightedIssueId: null,
    selectedIssueIds: [],
    peekOpen: false,
    layout: 'list',
    groupBy: 'status',
    subgroupBy: 'none',
    orderBy: 'status',
    displayProperties: [...DEFAULT_DISPLAY_PROPERTIES],
    filters: { ...EMPTY_FILTERS },
    filterAst: EMPTY_AST,
    savedViewId: null,
    pickerQuery: '',
    collectionRestore: null,
    pendingListScroll: null,
    listScrollTop: 0,
    drag: null,
    filterMenuOpen: false,
    displayMenuOpen: false,
    helpOpen: false,
    composerOpen: false,
    commandOpen: false,
    commandQuery: '',
    propertyMenu: null,
    inboxPane: 'triage',
    highlightedNotificationId: null,
    collapsedStateIds: [],
    selectionAnchorId: null,
    modalStack: [],
    composer: {
      title: '',
      description: '',
      teamId: team.id,
      stateId: defaultState.id,
      assigneeId: null,
      priority: 0,
      projectId: null,
      milestoneId: null,
      cycleId: currentCycle(snapshot.cycles)?.id ?? null,
      parentId: null,
      labelIds: [],
    },
  }
}

export function dataView(view: ViewId): ViewId {
  return view === 'board' ? 'all' : view
}

export function layoutLockedToList(view: ViewId): boolean {
  return view === 'inbox' || view === 'projects' || view === 'cycles' || view === 'initiatives'
}

export type WriteOrigin = 'local' | 'remote' | 'revert'

export type StoreOptions = {
  backend?: SyncBackend
  online?: boolean
}

export class NockStore {
  version = 0
  lastSyncId = 0
  currentUserId = ''
  workspace!: Workspace
  teams = new Map<string, Team>()
  users = new Map<string, User>()
  states = new Map<string, WorkflowState>()
  labels = new Map<string, Label>()
  projects = new Map<string, Project>()
  cycles = new Map<string, Cycle>()
  milestones = new Map<string, Milestone>()
  initiatives = new Map<string, Initiative>()
  documents = new Map<string, PlanningDocument>()
  issues = new Map<string, Issue>()
  projectUpdates = new Map<string, ProjectUpdate>()
  comments = new Map<string, IssueComment>()
  activities = new Map<string, IssueActivity>()
  attachments = new Map<string, IssueLink>()
  savedViews = new Map<string, SavedView>()
  notifications = new Map<string, InboxNotification>()
  customerRequests = new Map<string, CustomerRequest>()
  snoozes = new Map<string, number>()
  triageRules: TriageRule[] = []
  inboxDelivery: DeliveryPreferences = defaultDeliveryPreferences()
  ui!: UiState
  commands: CommandSystem
  sync: SyncEngine
  realtime: RealtimeClient | null = null

  persistError: string | null = null
  private listeners = new Set<() => void>()
  private persist: Persistence
  private persistChain: Promise<void> = Promise.resolve()

  constructor(persist: Persistence, backend: SyncBackend = new ImmediateAckBackend()) {
    this.persist = persist
    this.sync = new SyncEngine(this, backend)
    this.commands = new CommandSystem(this)
  }

  static from(
    snapshot: Snapshot,
    persist: Persistence = new MemoryPersistence(),
    options: StoreOptions = {},
  ): NockStore {
    const store = new NockStore(persist, options.backend ?? new ImmediateAckBackend())
    if (options.online === false) store.sync.online = false
    store.hydrate(snapshot)
    void store.sync.pump()
    return store
  }

  static async open(persist: Persistence, options: StoreOptions = {}): Promise<NockStore> {
    const loaded = await persist.load()
    const snapshot = loaded ?? createWorkspaceSnapshot()
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    const backend =
      options.backend ?? (await tryGraphqlBackend()) ?? new ImmediateAckBackend()
    const store = NockStore.from(snapshot, persist, { ...options, backend, online })
    store.listenToNetwork()
    if (backend instanceof GraphQLSyncBackend) {
      store.realtime = attachGraphqlRealtime(store, backend)
      void store.realtime.connect()
    }
    if (!loaded) {
      store.queuePersist()
      await store.flush()
    }
    return store
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }

  bump(): void {
    this.emit()
  }

  pushModal(id: OverlayId): void {
    this.ui.modalStack = this.ui.modalStack.filter((item) => item !== id)
    this.ui.modalStack.push(id)
  }

  dropModal(id: OverlayId): void {
    this.ui.modalStack = this.ui.modalStack.filter((item) => item !== id)
  }

  hydrate(snapshot: Snapshot): void {
    this.lastSyncId = snapshot.lastSyncId
    this.currentUserId = snapshot.currentUserId
    this.workspace = { ...snapshot.workspace }
    this.teams = new Map(snapshot.teams.map((team) => [team.id, { ...team }]))
    this.users = new Map(snapshot.users.map((user) => [user.id, { ...user }]))
    this.states = new Map(
      snapshot.states.map((state) => [state.id, { ...state }]),
    )
    this.labels = new Map(
      snapshot.labels.map((label) => [label.id, { ...label }]),
    )
    this.projects = new Map(
      snapshot.projects.map((project) => [project.id, normalizeProject(project)]),
    )
    this.cycles = new Map(
      snapshot.cycles.map((cycle) => [cycle.id, normalizeCycle(cycle)]),
    )
    this.milestones = new Map(
      (snapshot.milestones ?? []).map((milestone) => [
        milestone.id,
        normalizeMilestone(milestone),
      ]),
    )
    this.initiatives = new Map(
      (snapshot.initiatives ?? []).map((initiative) => [
        initiative.id,
        { ...initiative, projectIds: [...initiative.projectIds] },
      ]),
    )
    this.documents = new Map(
      (snapshot.documents ?? []).map((doc) => [doc.id, { ...doc }]),
    )
    this.issues = new Map(
      snapshot.issues.map((issue) => [issue.id, normalizeIssue(issue)]),
    )
    this.projectUpdates = new Map(
      (snapshot.projectUpdates ?? []).map((update) => [update.id, { ...update }]),
    )
    this.comments = new Map(
      (snapshot.comments ?? []).map((row) => [row.id, { ...row }]),
    )
    this.activities = new Map(
      (snapshot.activities ?? []).map((row) => [row.id, { ...row }]),
    )
    this.attachments = new Map(
      (snapshot.attachments ?? []).map((row) => [row.id, { ...row }]),
    )
    this.savedViews = new Map(
      (snapshot.savedViews ?? []).map((row) => [row.id, structuredClone(row)]),
    )
    this.notifications = new Map(
      (snapshot.notifications ?? []).map((row) => [row.id, { ...row }]),
    )
    this.customerRequests = new Map(
      (snapshot.customerRequests ?? []).map((row) => [row.id, { ...row }]),
    )
    this.snoozes = new Map(Object.entries(snapshot.snoozes ?? {}))
    this.triageRules = (snapshot.triageRules ?? []).map((rule) => structuredClone(rule))
    this.inboxDelivery = {
      ...defaultDeliveryPreferences(),
      ...snapshot.inboxDelivery,
    }
    this.ui = defaultUi(snapshot)
    this.repairCounters()
    this.commands?.undo.clear()
    this.sync.hydrate(snapshot.pendingCommands ?? [], snapshot.seenMutationIds ?? [])
  }

  serialize(): Snapshot {
    return {
      lastSyncId: this.lastSyncId,
      currentUserId: this.currentUserId,
      workspace: { ...this.workspace },
      teams: [...this.teams.values()].map((team) => ({ ...team })),
      users: [...this.users.values()].map((user) => ({ ...user })),
      states: [...this.states.values()].map((state) => ({ ...state })),
      labels: [...this.labels.values()].map((label) => ({ ...label })),
      projects: [...this.projects.values()].map((project) => ({ ...project })),
      cycles: [...this.cycles.values()].map((cycle) => ({ ...cycle })),
      milestones: [...this.milestones.values()].map((milestone) => ({
        ...milestone,
      })),
      initiatives: [...this.initiatives.values()].map((initiative) => ({
        ...initiative,
        projectIds: [...initiative.projectIds],
      })),
      documents: [...this.documents.values()].map((doc) => ({ ...doc })),
      issues: [...this.issues.values()].map((issue) => cloneIssue(issue)),
      projectUpdates: [...this.projectUpdates.values()].map((update) => ({
        ...update,
      })),
      comments: [...this.comments.values()].map((row) => ({ ...row })),
      activities: [...this.activities.values()].map((row) => ({ ...row })),
      attachments: [...this.attachments.values()].map((row) => ({ ...row })),
      savedViews: [...this.savedViews.values()].map((row) => structuredClone(row)),
      notifications: [...this.notifications.values()].map((row) => ({ ...row })),
      customerRequests: [...this.customerRequests.values()].map((row) => ({ ...row })),
      snoozes: Object.fromEntries(this.snoozes),
      triageRules: this.triageRules.map((rule) => structuredClone(rule)),
      inboxDelivery: { ...this.inboxDelivery },
      pendingCommands: this.sync.pending().map((command) => ({
        ...command,
        patch: command.patch ? { ...command.patch } : undefined,
        snapshot: command.snapshot ? cloneIssue(command.snapshot) : undefined,
        inverse:
          command.inverse.type === 'restore'
            ? { type: 'restore' as const, issue: cloneIssue(command.inverse.issue) }
            : command.inverse.type === 'patch'
              ? { type: 'patch' as const, patch: { ...command.inverse.patch } }
              : { type: 'delete' as const },
      })),
      seenMutationIds: [...this.sync.seenMutationIds],
    }
  }

  queuePersist(): void {
    const snapshot = this.serialize()
    this.persistChain = this.persistChain
      .then(async () => {
        await this.persist.save(snapshot)
        if (this.persistError) {
          this.persistError = null
          this.emit()
        }
      })
      .catch((error: unknown) => {
        const message = commandError(error)
        console.error('[nock] persist failed', error)
        if (this.persistError !== message) {
          this.persistError = message
          this.emit()
        }
      })
  }

  retryPersist(): void {
    this.queuePersist()
  }

  flush(): Promise<void> {
    return this.persistChain
  }

  async flushSync(): Promise<void> {
    await this.sync.pump()
    await this.flush()
  }

  listenToNetwork(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return
    }
    window.addEventListener('online', () => {
      this.sync.setOnline(true)
      void this.realtime?.connect()
    })
    window.addEventListener('offline', () => {
      this.sync.setOnline(false)
      this.realtime?.pause()
    })
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.sync.setOnline(false)
    }
  }

  execute(command: DomainCommand): CommandResult {
    try {
      switch (command.type) {
        case 'issue.create': {
          const issue = this.createIssue(command.input)
          return { ok: true, issueId: issue.id }
        }
        case 'issue.update':
          this.updateIssue(command.id, command.patch)
          return { ok: true, issueId: command.id }
        case 'issue.setProperty':
          this.applyProperty(command.kind, command.value)
          return { ok: true }
        case 'issue.acceptTriage':
          this.acceptTriage(command.view)
          return { ok: true }
        case 'issue.declineTriage':
          this.declineTriage(command.view)
          return { ok: true }
        case 'issue.moveToState':
          this.updateIssue(command.id, { stateId: command.stateId })
          return { ok: true, issueId: command.id }
        default: {
          const unseen: never = command
          return { ok: false, error: `unknown command: ${JSON.stringify(unseen)}` }
        }
      }
    } catch (error) {
      return { ok: false, error: commandError(error) }
    }
  }

  moveHighlightedAlongBoard(delta: number): CommandResult {
    const issue = this.highlightedIssue()
    if (!issue) return { ok: false, error: 'no highlighted issue' }
    const columns = this.boardStates()
    const index = columns.findIndex((state) => state.id === issue.stateId)
    const next = columns[index + delta]
    if (!next) return { ok: false, error: 'no adjacent column' }
    return this.execute({
      type: 'issue.moveToState',
      id: issue.id,
      stateId: next.id,
    })
  }

  private repairCounters(): void {
    for (const team of this.teams.values()) {
      let max = team.issueCounter
      for (const issue of this.issues.values()) {
        if (issue.teamId === team.id) max = Math.max(max, issue.number)
      }
      team.issueCounter = max
    }
  }

  defaultTeam(): Team {
    const team =
      this.teams.get(IDS.teamEng) ?? [...this.teams.values()][0]
    if (!team) throw new Error('[nock] no team in workspace')
    return team
  }

  statesForTeam(teamId: string): WorkflowState[] {
    return [...this.states.values()].filter((state) => state.teamId === teamId)
  }

  defaultState(teamId: string): WorkflowState {
    const states = this.statesForTeam(teamId)
    const fallback = states.find((state) => state.isDefault) ?? states[0]
    if (!fallback) throw new Error(`[nock] no workflow states for ${teamId}`)
    return fallback
  }

  canceledState(teamId: string): WorkflowState | undefined {
    return this.statesForTeam(teamId).find((state) => state.type === 'canceled')
  }

  stateById(id: string): WorkflowState {
    const state = this.states.get(id)
    if (!state) throw new Error(`[nock] state not found: ${id}`)
    return state
  }

  issue(id: string): Issue | undefined {
    return this.issues.get(id)
  }

  highlightedIssue(): Issue | undefined {
    return this.ui.highlightedIssueId
      ? this.issues.get(this.ui.highlightedIssueId)
      : undefined
  }

  peekedIssue(): Issue | undefined {
    if (!this.ui.peekOpen) return undefined
    return this.highlightedIssue()
  }

  actionIssueIds(): string[] {
    if (this.ui.selectedIssueIds.length > 0) return [...this.ui.selectedIssueIds]
    if (this.ui.highlightedIssueId) return [this.ui.highlightedIssueId]
    return []
  }

  actionIssue(): Issue | undefined {
    const id = this.actionIssueIds()[0]
    return id ? this.issues.get(id) : undefined
  }

  selectedIssue(): Issue | undefined {
    return this.actionIssue()
  }

  issueByIdentifier(identifier: string): Issue | undefined {
    const needle = identifier.trim().toUpperCase()
    return [...this.issues.values()].find((issue) => issue.identifier === needle)
  }

  viewQuery(view: ViewId): ViewQuery {
    return { view, filters: { ...this.ui.filters } }
  }

  issueIdsForView(view: ViewId): string[] {
    return this.issuesForView(view).map((issue) => issue.id)
  }

  issuesForView(view: ViewId): Issue[] {
    const live = [...this.issues.values()]
    const matched = applyExtraFilters(
      filterIssues(
        {
          issues: live,
          states: [...this.states.values()],
          currentUserId: this.currentUserId,
        },
        dataView(view),
        this.ui.orderBy,
      ),
      this.ui.filters,
      this.ui.filterAst,
    )
    const now = Date.now()
    return matched
      .map((issue) => this.issues.get(issue.id))
      .filter((issue): issue is Issue => Boolean(issue))
      .filter((issue) => view !== 'inbox' || !isSnoozed(this.snoozes.get(issue.id), now))
  }

  effectiveLayout(view: ViewId): Layout {
    if (layoutLockedToList(view)) return 'list'
    if (view === 'board') return 'board'
    return this.ui.layout
  }

  boardStates(): WorkflowState[] {
    return boardColumns(this.statesForTeam(this.defaultTeam().id))
  }

  private forgetIssue(id: string): void {
    if (this.ui.highlightedIssueId === id) {
      this.ui.highlightedIssueId = null
      this.ui.peekOpen = false
      this.dropModal('peek')
    }
    this.ui.selectedIssueIds = this.ui.selectedIssueIds.filter((row) => row !== id)
    if (this.ui.selectionAnchorId === id) this.ui.selectionAnchorId = null
    if (!this.ui.highlightedIssueId) this.ui.peekOpen = false
  }

  writeEntity(issue: Issue): void {
    this.issues.set(issue.id, normalizeIssue(issue))
  }

  removeEntity(id: string): void {
    this.issues.delete(id)
    this.forgetIssue(id)
  }

  applyInversePatch(inverse: InversePatch, issueId: string): void {
    if (inverse.type === 'patch') {
      if (this.issues.get(issueId)) this.updateIssue(issueId, inverse.patch, 'revert')
      return
    }
    if (inverse.type === 'delete') {
      if (this.issues.get(issueId)) this.deleteIssue(issueId, 'revert')
      return
    }
    this.restoreIssue(inverse.issue, 'revert')
  }

  private commitIssue(issue: Issue): Issue {
    const next = normalizeIssue({
      ...issue,
      updatedAt: Date.now(),
    })
    this.issues.set(next.id, next)
    return this.issues.get(next.id)!
  }

  createIssue(input: CreateIssueInput, origin: WriteOrigin = 'local'): Issue {
    const title = input.title.trim()
    if (!title) throw new Error('[nock] title is required')
    const team = this.teams.get(input.teamId ?? this.defaultTeam().id)
    if (!team) throw new Error('[nock] team not found')
    team.issueCounter += 1
    const number = team.issueCounter
    const now = Date.now()
    const issue = this.commitIssue({
      id: crypto.randomUUID(),
      teamId: team.id,
      number,
      identifier: formatIdentifier(team.key, number),
      title,
      description: input.description ?? '',
      priority: input.priority ?? 0,
      stateId: input.stateId ?? this.defaultState(team.id).id,
      assigneeId: input.assigneeId === undefined ? null : input.assigneeId,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      cycleId: input.cycleId ?? null,
      labelIds: input.labelIds ?? [],
      parentId: input.parentId ?? null,
      subscriberIds: [this.currentUserId],
      relatedIssueIds: [],
      blockedByIds: [],
      duplicateOfId: null,
      archivedAt: null,
      sortOrder: number,
      createdAt: now,
      updatedAt: now,
      syncId: 0,
      revision: 0,
      lastMutationId: null,
    })
    if (origin === 'local') {
      this.sync.enqueue({
        kind: 'issue.upsert',
        issueId: issue.id,
        snapshot: cloneIssue(issue),
        inverse: { type: 'delete' },
        baseRevision: issue.revision,
      })
      this.queuePersist()
      void this.sync.pump()
    }
    this.emit()
    if (origin !== 'local') this.queuePersist()
    return issue
  }

  updateIssue(id: string, patch: IssuePatch, origin: WriteOrigin = 'local'): Issue {
    const current = this.issues.get(id)
    if (!current) throw new Error(`[nock] issue not found: ${id}`)
    const inverse = pickInverse(current, patch)
    const next: Issue = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      number: current.number,
      identifier: current.identifier,
      revision: current.revision,
      lastMutationId: current.lastMutationId,
      syncId: current.syncId,
      labelIds: patch.labelIds ? [...patch.labelIds] : [...current.labelIds],
      subscriberIds: patch.subscriberIds
        ? [...patch.subscriberIds]
        : [...current.subscriberIds],
      relatedIssueIds: patch.relatedIssueIds
        ? [...patch.relatedIssueIds]
        : [...current.relatedIssueIds],
      blockedByIds: patch.blockedByIds
        ? [...patch.blockedByIds]
        : [...current.blockedByIds],
    }
    if (patch.teamId && patch.teamId !== current.teamId) {
      const team = this.teams.get(patch.teamId)
      if (!team) throw new Error('[nock] team not found')
      next.teamId = team.id
      if (typeof patch.number === 'number' && patch.identifier) {
        next.number = patch.number
        next.identifier = patch.identifier
      } else {
        team.issueCounter += 1
        next.number = team.issueCounter
        next.identifier = formatIdentifier(team.key, team.issueCounter)
      }
    }
    const saved = this.commitIssue(next)
    if (origin === 'local') {
      this.sync.enqueue({
        kind: 'issue.upsert',
        issueId: saved.id,
        patch,
        inverse: { type: 'patch', patch: inverse },
        baseRevision: current.revision,
      })
      this.queuePersist()
      void this.sync.pump()
    }
    this.emit()
    if (origin !== 'local') this.queuePersist()
    return saved
  }

  restoreIssue(issue: Issue, origin: WriteOrigin = 'local'): Issue {
    const next = this.commitIssue(cloneIssue(issue))
    const team = this.teams.get(next.teamId)
    if (team) team.issueCounter = Math.max(team.issueCounter, next.number)
    if (origin === 'local') {
      this.sync.enqueue({
        kind: 'issue.upsert',
        issueId: next.id,
        snapshot: cloneIssue(next),
        inverse: { type: 'delete' },
        baseRevision: next.revision,
      })
      this.queuePersist()
      void this.sync.pump()
    }
    this.emit()
    if (origin !== 'local') this.queuePersist()
    return next
  }

  deleteIssue(id: string, origin: WriteOrigin = 'local'): void {
    const current = this.issues.get(id)
    if (!current) throw new Error(`[nock] issue not found: ${id}`)
    const snapshot = cloneIssue(current)
    this.issues.delete(id)
    this.forgetIssue(id)
    if (origin === 'local') {
      this.sync.enqueue({
        kind: 'issue.delete',
        issueId: id,
        snapshot,
        inverse: { type: 'restore', issue: snapshot },
        baseRevision: current.revision,
      })
      this.queuePersist()
      void this.sync.pump()
    }
    this.emit()
    if (origin !== 'local') this.queuePersist()
  }

  applyRemoteIssue(issue: Issue): Issue {
    const revision = issue.revision ?? issue.syncId
    const mutationId =
      issue.lastMutationId && !this.sync.seenMutationIds.has(issue.lastMutationId)
        ? issue.lastMutationId
        : `remote:${issue.id}:${revision}`
    this.sync.applyRemote({
      mutationId,
      revision,
      issueId: issue.id,
      issue: normalizeIssue(issue),
    })
    return this.issues.get(issue.id) ?? issue
  }

  highlightIssue(id: string | null): void {
    this.ui.highlightedIssueId = id
    this.ui.propertyMenu = null
    if (!id) this.ui.peekOpen = false
    this.emit()
  }

  clickIssue(id: string): void {
    this.ui.highlightedIssueId = id
    this.ui.selectedIssueIds = [id]
    this.ui.selectionAnchorId = id
    this.ui.propertyMenu = null
    this.emit()
  }

  clearSelection(): void {
    this.ui.selectedIssueIds = []
    this.ui.selectionAnchorId = null
    this.emit()
  }

  toggleSelect(id?: string): void {
    const target = id ?? this.ui.highlightedIssueId
    if (!target) return
    this.ui.highlightedIssueId = target
    const selected = new Set(this.ui.selectedIssueIds)
    if (selected.has(target)) selected.delete(target)
    else selected.add(target)
    this.ui.selectedIssueIds = [...selected]
    this.ui.selectionAnchorId = target
    this.emit()
  }

  togglePeek(): void {
    if (!this.ui.highlightedIssueId) return
    this.ui.peekOpen = !this.ui.peekOpen
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    if (this.ui.peekOpen) this.pushModal('peek')
    else this.dropModal('peek')
    this.emit()
  }

  openIssuePeek(id: string): void {
    this.ui.highlightedIssueId = id
    this.ui.peekOpen = true
    this.ui.commandOpen = false
    this.ui.propertyMenu = null
    this.dropModal('command')
    this.dropModal('property')
    this.pushModal('peek')
    this.emit()
  }

  previewIssue(id: string): void {
    this.ui.highlightedIssueId = id
    this.ui.peekOpen = true
    this.emit()
  }

  selectIssue(id: string | null): void {
    if (!id) {
      this.ui.highlightedIssueId = null
      this.ui.selectedIssueIds = []
      this.ui.peekOpen = false
    } else {
      this.ui.highlightedIssueId = id
      this.ui.selectedIssueIds = [id]
    }
    this.ui.propertyMenu = null
    this.emit()
  }

  setLayout(layout: Layout): void {
    this.ui.layout = layout
    this.emit()
  }

  toggleLayout(view?: ViewId): void {
    if (view && layoutLockedToList(view)) return
    this.ui.layout = this.ui.layout === 'list' ? 'board' : 'list'
    this.emit()
  }

  setGroupBy(groupBy: GroupBy): void {
    this.ui.groupBy = groupBy
    this.emit()
  }

  setSubgroupBy(subgroupBy: GroupBy): void {
    this.ui.subgroupBy = subgroupBy
    this.emit()
  }

  setOrderBy(orderBy: OrderBy): void {
    this.ui.orderBy = orderBy
    this.emit()
  }

  setPickerQuery(query: string): void {
    this.ui.pickerQuery = query
    this.emit()
  }

  rememberCollection(restore: CollectionRestore): void {
    this.ui.collectionRestore = restore
  }

  consumeCollectionRestore(): CollectionRestore | null {
    const restore = this.ui.collectionRestore
    this.ui.collectionRestore = null
    return restore
  }

  setDrag(drag: BoardDrag | null): void {
    this.ui.drag = drag
    this.emit()
  }

  dropIssuesOnColumn(stateId: string, issueIds: string[], index: number | null): void {
    const ids = issueIds.filter((id) => this.issues.has(id))
    if (ids.length === 0) return
    const remaining = [...this.issues.values()]
      .filter((issue) => issue.stateId === stateId && !ids.includes(issue.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const insertAt = Math.max(0, Math.min(index ?? remaining.length, remaining.length))
    const ordered = [
      ...remaining.slice(0, insertAt),
      ...ids.map((id) => this.issues.get(id)!),
      ...remaining.slice(insertAt),
    ]
    const dragged = new Set(ids)
    const changed = ordered
      .map((issue, row) => ({
        issue,
        patch: { stateId, sortOrder: (row + 1) * 10 },
      }))
      .filter(
        (row) =>
          row.issue.stateId !== row.patch.stateId ||
          row.issue.sortOrder !== row.patch.sortOrder,
      )
      .sort((a, b) => Number(dragged.has(b.issue.id)) - Number(dragged.has(a.issue.id)))
    for (const row of changed) {
      this.updateIssue(row.issue.id, row.patch)
    }
    this.ui.drag = null
    this.emit()
  }

  saveView(name: string, view: ViewId): SavedView {
    const saved: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled view',
      view,
      layout: this.ui.layout,
      groupBy: this.ui.groupBy,
      subgroupBy: this.ui.subgroupBy,
      orderBy: this.ui.orderBy,
      displayProperties: [...this.ui.displayProperties],
      filters: { ...this.ui.filters },
      ast: structuredClone(this.ui.filterAst),
    }
    this.savedViews.set(saved.id, saved)
    this.ui.savedViewId = saved.id
    this.emit()
    this.queuePersist()
    return saved
  }

  applySavedView(id: string): void {
    const saved = this.savedViews.get(id)
    if (!saved) return
    this.ui.layout = saved.layout
    this.ui.groupBy = saved.groupBy
    this.ui.subgroupBy = saved.subgroupBy
    this.ui.orderBy = saved.orderBy
    this.ui.displayProperties = [...saved.displayProperties]
    this.ui.filters = { ...saved.filters }
    this.ui.filterAst = structuredClone(saved.ast)
    this.ui.savedViewId = saved.id
    this.emit()
  }

  addComment(issueId: string, body: string): IssueComment {
    const text = body.trim()
    if (!text) throw new Error('[nock] comment is required')
    if (!this.issues.get(issueId)) throw new Error('[nock] issue not found')
    const comment: IssueComment = {
      id: crypto.randomUUID(),
      issueId,
      authorId: this.currentUserId,
      body: text,
      createdAt: Date.now(),
    }
    this.comments.set(comment.id, comment)
    this.activities.set(comment.id, {
      id: crypto.randomUUID(),
      issueId,
      authorId: this.currentUserId,
      body: `Commented: ${text}`,
      createdAt: comment.createdAt,
    })
    this.emit()
    this.queuePersist()
    return comment
  }

  addLink(issueId: string, url: string, title: string): IssueLink {
    if (!this.issues.get(issueId)) throw new Error('[nock] issue not found')
    const link: IssueLink = {
      id: crypto.randomUUID(),
      issueId,
      url: url.trim(),
      title: title.trim() || url.trim(),
    }
    this.attachments.set(link.id, link)
    this.emit()
    this.queuePersist()
    return link
  }

  commentsForIssue(issueId: string): IssueComment[] {
    return [...this.comments.values()]
      .filter((row) => row.issueId === issueId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  activitiesForIssue(issueId: string): IssueActivity[] {
    return [...this.activities.values()]
      .filter((row) => row.issueId === issueId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  linksForIssue(issueId: string): IssueLink[] {
    return [...this.attachments.values()].filter((row) => row.issueId === issueId)
  }

  childIssues(parentId: string): Issue[] {
    return [...this.issues.values()]
      .filter((issue) => issue.parentId === parentId && !issue.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  toggleDisplayProperty(property: DisplayProperty): void {
    const current = new Set(this.ui.displayProperties)
    if (current.has(property)) current.delete(property)
    else current.add(property)
    this.ui.displayProperties = DEFAULT_DISPLAY_PROPERTIES.filter((item) =>
      current.has(item),
    )
    this.emit()
  }

  setFilters(filters: IssueFilters): void {
    const next = { ...EMPTY_FILTERS, ...filters }
    if (
      this.ui.filters.assigneeId === next.assigneeId &&
      this.ui.filters.stateId === next.stateId &&
      this.ui.filters.priority === next.priority &&
      this.ui.filters.projectId === next.projectId &&
      this.ui.filters.cycleId === next.cycleId
    ) {
      return
    }
    this.ui.filters = next
    this.ui.filterAst = astFromFilters(next)
    this.ui.savedViewId = null
    this.emit()
  }

  setFilter<K extends keyof IssueFilters>(key: K, value: IssueFilters[K]): void {
    this.ui.filters = { ...this.ui.filters, [key]: value }
    this.ui.filterAst = astFromFilters(this.ui.filters)
    this.ui.savedViewId = null
    this.emit()
  }

  clearFilters(): void {
    this.ui.filters = { ...EMPTY_FILTERS }
    this.ui.filterAst = EMPTY_AST
    this.ui.savedViewId = null
    this.emit()
  }

  toggleFilterMenu(): void {
    this.ui.filterMenuOpen = !this.ui.filterMenuOpen
    this.ui.displayMenuOpen = false
    this.ui.helpOpen = false
    this.dropModal('display')
    this.dropModal('help')
    if (this.ui.filterMenuOpen) this.pushModal('filter')
    else this.dropModal('filter')
    this.emit()
  }

  toggleDisplayMenu(): void {
    this.ui.displayMenuOpen = !this.ui.displayMenuOpen
    this.ui.filterMenuOpen = false
    this.ui.helpOpen = false
    this.dropModal('filter')
    this.dropModal('help')
    if (this.ui.displayMenuOpen) this.pushModal('display')
    else this.dropModal('display')
    this.emit()
  }

  toggleHelp(): void {
    this.ui.helpOpen = !this.ui.helpOpen
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.dropModal('filter')
    this.dropModal('display')
    if (this.ui.helpOpen) this.pushModal('help')
    else this.dropModal('help')
    this.emit()
  }

  closeMenus(): void {
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.ui.helpOpen = false
    this.dropModal('filter')
    this.dropModal('display')
    this.dropModal('help')
    this.emit()
  }

  toggleCollapsed(stateId: string): void {
    const collapsed = new Set(this.ui.collapsedStateIds)
    if (collapsed.has(stateId)) collapsed.delete(stateId)
    else collapsed.add(stateId)
    this.ui.collapsedStateIds = [...collapsed]
    this.emit()
  }

  openComposer(fromView?: ViewId, options?: { parentId?: string }): void {
    const team = this.defaultTeam()
    let stateId = this.defaultState(team.id).id
    if (fromView === 'inbox') {
      stateId =
        this.statesForTeam(team.id).find((state) => state.type === 'triage')
          ?.id ?? stateId
    }
    if (fromView === 'backlog') {
      stateId =
        this.statesForTeam(team.id).find((state) => state.type === 'backlog')
          ?.id ?? stateId
    }
    this.ui.composerOpen = true
    this.ui.commandOpen = false
    this.ui.propertyMenu = null
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.ui.helpOpen = false
    this.dropModal('command')
    this.dropModal('property')
    this.dropModal('filter')
    this.dropModal('display')
    this.dropModal('help')
    this.pushModal('composer')
    this.ui.composer = {
      title: '',
      description: '',
      teamId: team.id,
      stateId,
      assigneeId: null,
      priority: 0,
      projectId: null,
      milestoneId: null,
      cycleId: currentCycle([...this.cycles.values()])?.id ?? null,
      parentId: options?.parentId ?? null,
      labelIds: [],
    }
    this.emit()
  }

  setComposer(patch: Partial<UiState['composer']>): void {
    this.ui.composer = { ...this.ui.composer, ...patch }
    this.emit()
  }

  submitComposer(): Issue | null {
    const title = this.ui.composer.title.trim()
    if (!title) return null
    const result = this.execute({
      type: 'issue.create',
      input: {
        title,
        description: this.ui.composer.description,
        teamId: this.ui.composer.teamId,
        stateId: this.ui.composer.stateId,
        assigneeId: this.ui.composer.assigneeId,
        priority: this.ui.composer.priority,
        projectId: this.ui.composer.projectId,
        milestoneId: this.ui.composer.milestoneId,
        cycleId: this.ui.composer.cycleId,
        parentId: this.ui.composer.parentId,
        labelIds: this.ui.composer.labelIds,
      },
    })
    if (!result.ok || !result.issueId) return null
    const issue = this.issues.get(result.issueId)
    if (!issue) return null
    this.ui.composerOpen = false
    this.dropModal('composer')
    this.ui.highlightedIssueId = issue.id
    this.ui.peekOpen = true
    this.emit()
    return issue
  }

  openCommand(): void {
    this.ui.commandOpen = true
    this.ui.composerOpen = false
    this.ui.commandQuery = ''
    this.ui.propertyMenu = null
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.dropModal('composer')
    this.dropModal('property')
    this.dropModal('filter')
    this.dropModal('display')
    this.pushModal('command')
    this.emit()
  }

  closeCommand(): void {
    this.ui.commandOpen = false
    this.dropModal('command')
    this.emit()
  }

  setCommandQuery(query: string): void {
    this.ui.commandQuery = query
    this.emit()
  }

  dismissOverlays(): void {
    const top = this.ui.modalStack[this.ui.modalStack.length - 1]
    if (top) {
      this.closeOverlay(top)
      this.emit()
      return
    }
    if (this.ui.selectedIssueIds.length > 0) {
      this.ui.selectedIssueIds = []
      this.ui.selectionAnchorId = null
      this.emit()
      return
    }
    if (this.ui.highlightedIssueId) {
      this.ui.highlightedIssueId = null
      this.emit()
    }
  }

  private closeOverlay(id: OverlayId): void {
    if (id === 'help') this.ui.helpOpen = false
    if (id === 'display') this.ui.displayMenuOpen = false
    if (id === 'filter') this.ui.filterMenuOpen = false
    if (id === 'property') this.ui.propertyMenu = null
    if (id === 'command') this.ui.commandOpen = false
    if (id === 'composer') this.ui.composerOpen = false
    if (id === 'peek') this.ui.peekOpen = false
    this.dropModal(id)
  }

  openPropertyMenu(kind: PropertyMenuKind): void {
    if (this.actionIssueIds().length === 0 && !this.ui.composerOpen) return
    if (this.ui.propertyMenu === kind) {
      this.ui.propertyMenu = null
      this.dropModal('property')
    } else {
      this.ui.propertyMenu = kind
      this.ui.pickerQuery = ''
      this.pushModal('property')
    }
    this.emit()
  }

  applyProperty(kind: PropertyMenuKind, value: string | number | null): void {
    const normalized =
      value === '' || value === null ? null : value
    if (this.ui.composerOpen) {
      if (kind === 'status') this.setComposer({ stateId: String(value) })
      if (kind === 'priority')
        this.setComposer({ priority: Number(value) as Priority })
      if (kind === 'assignee')
        this.setComposer({
          assigneeId: normalized === null ? null : String(normalized),
        })
      if (kind === 'project')
        this.setComposer({
          projectId: normalized === null ? null : String(normalized),
        })
      if (kind === 'cycle')
        this.setComposer({
          cycleId: normalized === null ? null : String(normalized),
        })
      if (kind === 'milestone')
        this.setComposer({
          milestoneId: normalized === null ? null : String(normalized),
        })
      if (kind === 'label') {
        const labelId = String(value)
        const ids = new Set(this.ui.composer.labelIds)
        if (ids.has(labelId)) ids.delete(labelId)
        else ids.add(labelId)
        this.setComposer({ labelIds: [...ids] })
      }
      this.ui.propertyMenu = null
      this.dropModal('property')
      this.emit()
      return
    }
    const ids = this.actionIssueIds()
    if (ids.length === 0) return
    if (kind === 'duplicate') {
      if (normalized) this.duplicateTriage(String(normalized))
      this.ui.propertyMenu = null
      this.dropModal('property')
      this.emit()
      return
    }
    if (kind === 'label') {
      const labelId = String(value)
      for (const issueId of ids) {
        const issue = this.issues.get(issueId)
        if (!issue) continue
        const labelIds = issue.labelIds.includes(labelId)
          ? issue.labelIds.filter((id) => id !== labelId)
          : [...issue.labelIds, labelId]
        this.updateIssue(issueId, { labelIds })
      }
      this.ui.propertyMenu = null
      this.dropModal('property')
      this.emit()
      return
    }
    const patch: IssuePatch =
      kind === 'status'
        ? { stateId: String(value) }
        : kind === 'priority'
          ? { priority: Number(value) as Priority }
          : kind === 'assignee'
            ? { assigneeId: normalized === null ? null : String(normalized) }
            : kind === 'project'
              ? { projectId: normalized === null ? null : String(normalized) }
              : kind === 'milestone'
                ? { milestoneId: normalized === null ? null : String(normalized) }
                : kind === 'team'
                  ? { teamId: String(value) }
                  : { cycleId: normalized === null ? null : String(normalized) }
    for (const issueId of ids) this.updateIssue(issueId, patch)
    this.ui.propertyMenu = null
    this.dropModal('property')
    this.emit()
  }

  highlightRelative(view: ViewId, delta: number): void {
    const issues = this.issuesForView(view)
    if (issues.length === 0) return
    const index = issues.findIndex(
      (issue) => issue.id === this.ui.highlightedIssueId,
    )
    const nextIndex = Math.min(
      issues.length - 1,
      Math.max(0, (index < 0 ? (delta > 0 ? -1 : 0) : index) + delta),
    )
    this.ui.highlightedIssueId = issues[nextIndex].id
    this.ui.propertyMenu = null
    this.emit()
  }

  selectRelative(view: ViewId, delta: number): void {
    this.highlightRelative(view, delta)
  }

  private triageTargets(): Issue[] {
    return this.actionIssueIds()
      .map((id) => this.issues.get(id))
      .filter((issue): issue is Issue => {
        if (!issue) return false
        return this.states.get(issue.stateId)?.type === 'triage'
      })
  }

  private highlightAfterLeaving(view: ViewId, removedIds: string[]): void {
    const remaining = this.issuesForView(view)
    this.ui.selectedIssueIds = this.ui.selectedIssueIds.filter(
      (id) => !removedIds.includes(id),
    )
    if (remaining.length === 0) {
      this.ui.highlightedIssueId = null
      this.ui.peekOpen = false
      return
    }
    if (
      this.ui.highlightedIssueId &&
      remaining.some((issue) => issue.id === this.ui.highlightedIssueId)
    ) {
      return
    }
    this.ui.highlightedIssueId = remaining[0].id
  }

  acceptTriage(view: ViewId = 'inbox'): void {
    const targets = this.triageTargets()
    if (targets.length === 0) return
    const defaultId = this.defaultState(this.defaultTeam().id).id
    const removed = targets.map((issue) => issue.id)
    for (const issue of targets) {
      const ruled = applyTriageRules(issue, this.triageRules)
      this.updateIssue(issue.id, { ...ruled, stateId: ruled.stateId ?? defaultId })
    }
    this.highlightAfterLeaving(view, removed)
    this.emit()
  }

  declineTriage(view: ViewId = 'inbox'): void {
    const canceled = this.canceledState(this.defaultTeam().id)
    if (!canceled) return
    const targets = this.triageTargets()
    if (targets.length === 0) return
    const removed = targets.map((issue) => issue.id)
    for (const issue of targets)
      this.updateIssue(issue.id, { stateId: canceled.id })
    this.highlightAfterLeaving(view, removed)
    this.emit()
  }

  snoozeTriage(days = 1, view: ViewId = 'inbox'): void {
    const targets = this.triageTargets()
    if (targets.length === 0) return
    const until = snoozeUntil(Date.now(), days)
    const removed = targets.map((issue) => issue.id)
    for (const id of removed) this.snoozes.set(id, until)
    this.highlightAfterLeaving(view, removed)
    this.emit()
    this.queuePersist()
  }

  restoreSnoozes(entries: Array<{ id: string; until: number | null }>): void {
    for (const row of entries) {
      if (row.until == null) this.snoozes.delete(row.id)
      else this.snoozes.set(row.id, row.until)
    }
    this.emit()
    this.queuePersist()
  }

  duplicateTriage(canonicalId: string, view: ViewId = 'inbox'): void {
    const canonical = this.issues.get(canonicalId)
    const duplicateState = this.statesForTeam(this.defaultTeam().id).find(
      (state) => state.type === 'duplicate',
    )
    if (!canonical || !duplicateState) return
    const targets = this.triageTargets().filter((issue) => issue.id !== canonicalId)
    if (targets.length === 0) return
    const removed = targets.map((issue) => issue.id)
    const merged = mergeSupportLinks({
      fromId: targets[0]!.id,
      intoId: canonicalId,
      links: [...this.attachments.values()],
      requests: [...this.customerRequests.values()],
    })
    this.attachments = new Map(merged.links.map((link) => [link.id, link]))
    this.customerRequests = new Map(merged.requests.map((row) => [row.id, row]))
    for (const extra of targets.slice(1)) {
      const more = mergeSupportLinks({
        fromId: extra.id,
        intoId: canonicalId,
        links: [...this.attachments.values()],
        requests: [...this.customerRequests.values()],
      })
      this.attachments = new Map(more.links.map((link) => [link.id, link]))
      this.customerRequests = new Map(more.requests.map((row) => [row.id, row]))
    }
    for (const issue of targets) {
      this.updateIssue(issue.id, {
        duplicateOfId: canonicalId,
        stateId: duplicateState.id,
      })
    }
    this.highlightAfterLeaving(view, removed)
    this.emit()
    this.queuePersist()
  }

  inboxNotifications(pane: 'priority' | 'other'): InboxNotification[] {
    return splitInbox([...this.notifications.values()], this.currentUserId)[pane]
  }

  highlightNotification(id: string | null): void {
    this.ui.highlightedNotificationId = id
    this.emit()
  }

  highlightNotificationRelative(delta: number): void {
    const pane = this.ui.inboxPane
    if (pane === 'triage') return
    const rows = this.inboxNotifications(pane)
    if (rows.length === 0) return
    const index = rows.findIndex((row) => row.id === this.ui.highlightedNotificationId)
    const nextIndex = Math.min(
      rows.length - 1,
      Math.max(0, (index < 0 ? (delta > 0 ? -1 : 0) : index) + delta),
    )
    this.ui.highlightedNotificationId = rows[nextIndex]!.id
    this.emit()
  }

  openNotification(id?: string): InboxNotification | null {
    const pane = this.ui.inboxPane
    if (pane === 'triage') return null
    const target = id ?? this.ui.highlightedNotificationId
    const row = target ? this.notifications.get(id ?? target) : undefined
    if (!row) return null
    this.ui.highlightedNotificationId = row.id
    this.markInboxRead(row.id)
    return row
  }

  setDeliveryPreference(type: InboxNotification['type'], enabled: boolean): void {
    this.inboxDelivery = { ...this.inboxDelivery, [type]: enabled }
    this.emit()
    this.queuePersist()
  }

  markInboxRead(id?: string): void {
    const now = Date.now()
    if (id) {
      const row = this.notifications.get(id)
      if (row) this.notifications.set(id, { ...row, readAt: now })
    } else {
      for (const row of markAllRead([...this.notifications.values()], this.currentUserId, now)) {
        this.notifications.set(row.id, row)
      }
    }
    this.emit()
    this.queuePersist()
  }

  archiveInbox(id: string): void {
    const row = this.notifications.get(id)
    if (!row) return
    const pane = this.ui.inboxPane === 'triage' ? 'priority' : this.ui.inboxPane
    const rows = this.inboxNotifications(pane)
    const index = rows.findIndex((item) => item.id === id)
    this.notifications.set(id, { ...row, archivedAt: Date.now() })
    const remaining = this.inboxNotifications(pane)
    if (this.ui.highlightedNotificationId === id) {
      this.ui.highlightedNotificationId =
        remaining[Math.min(index, remaining.length - 1)]?.id ?? null
    }
    this.emit()
    this.queuePersist()
  }

  setInboxOverride(id: string, score: number | null): void {
    const row = this.notifications.get(id)
    if (!row) return
    this.notifications.set(id, { ...row, priorityOverride: score })
    this.emit()
    this.queuePersist()
  }

  setInboxPane(pane: 'triage' | 'priority' | 'other'): void {
    this.ui.inboxPane = pane
    if (pane !== 'triage') {
      const rows = this.inboxNotifications(pane)
      this.ui.highlightedNotificationId = rows[0]?.id ?? null
    }
    this.emit()
  }

  searchIssues(query: string): Issue[] {
    return [...this.issues.values()]
      .filter(
        (issue) =>
          !issue.archivedAt &&
          fuzzyMatch(query, `${issue.identifier} ${issue.title}`),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }

  updatesForProject(projectId: string): ProjectUpdate[] {
    return [...this.projectUpdates.values()]
      .filter((update) => update.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  latestUpdate(projectId: string): ProjectUpdate | undefined {
    return this.updatesForProject(projectId)[0]
  }

  issuesForProject(projectId: string): Issue[] {
    return [...this.issues.values()]
      .filter((issue) => issue.projectId === projectId && !issue.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  projectProgress(projectId: string): {
    total: number
    completed: number
    ratio: number
  } {
    const issues = [...this.issues.values()].filter(
      (issue) => issue.projectId === projectId && !issue.archivedAt,
    )
    const completed = issues.filter(
      (issue) => this.states.get(issue.stateId)?.type === 'completed',
    ).length
    return {
      total: issues.length,
      completed,
      ratio: issues.length === 0 ? 0 : completed / issues.length,
    }
  }

  updateProject(id: string, patch: Partial<Project>): void {
    const project = this.projects.get(id)
    if (!project) return
    this.projects.set(
      id,
      normalizeProject({
        ...project,
        ...patch,
        updatedAt: Date.now(),
      }),
    )
    this.emit()
    this.queuePersist()
  }

  setProjectDates(id: string, startAt: number, targetAt: number): void {
    this.updateProject(id, { startAt, targetAt })
  }

  setProjectBlockedBy(id: string, blockedByIds: string[]): void {
    this.updateProject(id, { blockedByIds })
  }

  updateMilestone(id: string, patch: Partial<Milestone>): void {
    const milestone = this.milestones.get(id)
    if (!milestone) return
    this.milestones.set(id, normalizeMilestone({ ...milestone, ...patch }))
    this.emit()
    this.queuePersist()
  }

  updateInitiative(id: string, patch: Partial<Initiative>): void {
    const initiative = this.initiatives.get(id)
    if (!initiative) return
    this.initiatives.set(id, {
      ...initiative,
      ...patch,
      projectIds: patch.projectIds ? [...patch.projectIds] : [...initiative.projectIds],
      updatedAt: Date.now(),
    })
    this.emit()
    this.queuePersist()
  }

  documentsFor(projectId: string): PlanningDocument[] {
    return [...this.documents.values()].filter((doc) => doc.projectId === projectId)
  }

  milestonesFor(projectId: string): Milestone[] {
    return [...this.milestones.values()]
      .filter((milestone) => milestone.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  classifiedCycles(now = Date.now()) {
    return classifyCycles([...this.cycles.values()], now)
  }

  issuesForCycle(cycleId: string): Issue[] {
    return [...this.issues.values()]
      .filter((issue) => issue.cycleId === cycleId && !issue.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  rolloverEndedCycles(now = Date.now()): Cycle[] {
    const created: Cycle[] = []
    const states = [...this.states.values()]
    for (const cycle of [...this.cycles.values()]) {
      if (cycle.completedAt != null || now <= cycle.endsAt) continue
      const team = this.teams.get(cycle.teamId)
      const result = rolloverCycle({
        cycle,
        issues: [...this.issues.values()],
        states,
        now,
        durationWeeks: team?.cycleDurationWeeks ?? 2,
      })
      this.cycles.set(result.completed.id, result.completed)
      const existingNext = [...this.cycles.values()].find(
        (row) => row.teamId === cycle.teamId && row.number === result.next.number,
      )
      const next = existingNext ?? result.next
      if (!existingNext) this.cycles.set(next.id, next)
      for (const moved of result.moved) {
        const current = this.issues.get(moved.id)
        if (!current) continue
        this.writeEntity({ ...current, cycleId: next.id, updatedAt: now })
      }
      created.push(next)
    }
    if (created.length > 0) {
      this.emit()
      this.queuePersist()
    }
    return created
  }

  me(): User {
    const user = this.users.get(this.currentUserId)
    if (!user) throw new Error('[nock] current user missing')
    return user
  }

  async resetDemo(): Promise<void> {
    this.hydrate(createWorkspaceSnapshot())
    this.emit()
    this.queuePersist()
    await this.flush()
  }
}

export type { Persistence }
export { MemoryPersistence }
export type { CommandResult, DomainCommand }
