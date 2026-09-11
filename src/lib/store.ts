import { applyExtraFilters, boardColumns, currentCycle, filterIssues, fuzzyMatch } from './filters'
import { formatIdentifier } from './identifiers'
import { MemoryPersistence, type Persistence } from './persist'
import { createWorkspaceSnapshot } from './seed-roadmap'
import { IDS } from './seed'
import type {
  CreateIssueInput,
  Cycle,
  DisplayProperty,
  GroupBy,
  Issue,
  IssueFilters,
  Label,
  Layout,
  Priority,
  Project,
  ProjectUpdate,
  PropertyMenuKind,
  Snapshot,
  Team,
  UiState,
  User,
  ViewId,
  WorkflowState,
  Workspace,
} from './types'
import { DEFAULT_DISPLAY_PROPERTIES, EMPTY_FILTERS } from './types'

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
    displayProperties: [...DEFAULT_DISPLAY_PROPERTIES],
    filters: { ...EMPTY_FILTERS },
    filterMenuOpen: false,
    displayMenuOpen: false,
    helpOpen: false,
    composerOpen: false,
    commandOpen: false,
    commandQuery: '',
    propertyMenu: null,
    collapsedStateIds: [],
    composer: {
      title: '',
      description: '',
      teamId: team.id,
      stateId: defaultState.id,
      assigneeId: null,
      priority: 0,
      projectId: null,
      cycleId: currentCycle(snapshot.cycles)?.id ?? null,
    },
  }
}

export function dataView(view: ViewId): ViewId {
  return view === 'board' ? 'all' : view
}

export function layoutLockedToList(view: ViewId): boolean {
  return view === 'inbox' || view === 'projects' || view === 'cycles'
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
  issues = new Map<string, Issue>()
  projectUpdates = new Map<string, ProjectUpdate>()
  ui!: UiState

  private listeners = new Set<() => void>()
  private persist: Persistence
  private persistChain: Promise<void> = Promise.resolve()

  constructor(persist: Persistence) {
    this.persist = persist
  }

  static from(
    snapshot: Snapshot,
    persist: Persistence = new MemoryPersistence(),
  ): NockStore {
    const store = new NockStore(persist)
    store.hydrate(snapshot)
    return store
  }

  static async open(persist: Persistence): Promise<NockStore> {
    const loaded = await persist.load()
    const snapshot = loaded ?? createWorkspaceSnapshot()
    const store = NockStore.from(snapshot, persist)
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
      snapshot.projects.map((project) => [
        project.id,
        {
          ...project,
          area: project.area ?? '',
          health: project.health ?? 'no-update',
        },
      ]),
    )
    this.cycles = new Map(
      snapshot.cycles.map((cycle) => [cycle.id, { ...cycle }]),
    )
    this.issues = new Map(
      snapshot.issues.map((issue) => [
        issue.id,
        { ...issue, labelIds: [...issue.labelIds] },
      ]),
    )
    this.projectUpdates = new Map(
      (snapshot.projectUpdates ?? []).map((update) => [update.id, { ...update }]),
    )
    this.ui = defaultUi(snapshot)
    this.repairCounters()
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
      issues: [...this.issues.values()].map((issue) => ({
        ...issue,
        labelIds: [...issue.labelIds],
      })),
      projectUpdates: [...this.projectUpdates.values()].map((update) => ({
        ...update,
      })),
    }
  }

  queuePersist(): void {
    const snapshot = this.serialize()
    this.persistChain = this.persistChain
      .then(() => this.persist.save(snapshot))
      .catch((error: unknown) => {
        console.error('[nock] persist failed', error)
      })
  }

  flush(): Promise<void> {
    return this.persistChain
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

  private nextSyncId(): number {
    this.lastSyncId += 1
    return this.lastSyncId
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

  issuesForView(view: ViewId): Issue[] {
    return applyExtraFilters(
      filterIssues(this.serialize(), dataView(view)),
      this.ui.filters,
    )
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
    if (this.ui.highlightedIssueId === id) this.ui.highlightedIssueId = null
    this.ui.selectedIssueIds = this.ui.selectedIssueIds.filter((row) => row !== id)
    if (!this.ui.highlightedIssueId) this.ui.peekOpen = false
  }

  private putIssue(issue: Issue): Issue {
    const next: Issue = {
      ...issue,
      labelIds: [...issue.labelIds],
      syncId: this.nextSyncId(),
      updatedAt: Date.now(),
    }
    this.issues.set(next.id, next)
    this.emit()
    this.queuePersist()
    return next
  }

  createIssue(input: CreateIssueInput): Issue {
    const title = input.title.trim()
    if (!title) throw new Error('[nock] title is required')
    const team = this.teams.get(input.teamId ?? this.defaultTeam().id)
    if (!team) throw new Error('[nock] team not found')
    team.issueCounter += 1
    const number = team.issueCounter
    const now = Date.now()
    return this.putIssue({
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
      cycleId: input.cycleId ?? null,
      labelIds: input.labelIds ?? [],
      parentId: null,
      sortOrder: number,
      createdAt: now,
      updatedAt: now,
      syncId: 0,
    })
  }

  updateIssue(
    id: string,
    patch: Partial<
      Pick<
        Issue,
        | 'title'
        | 'description'
        | 'priority'
        | 'stateId'
        | 'assigneeId'
        | 'projectId'
        | 'cycleId'
        | 'labelIds'
        | 'sortOrder'
        | 'parentId'
        | 'teamId'
      >
    >,
  ): Issue {
    const current = this.issues.get(id)
    if (!current) throw new Error(`[nock] issue not found: ${id}`)
    const next: Issue = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      number: current.number,
      identifier: current.identifier,
      labelIds: patch.labelIds ? [...patch.labelIds] : [...current.labelIds],
    }
    if (patch.teamId && patch.teamId !== current.teamId) {
      const team = this.teams.get(patch.teamId)
      if (!team) throw new Error('[nock] team not found')
      team.issueCounter += 1
      next.teamId = team.id
      next.number = team.issueCounter
      next.identifier = formatIdentifier(team.key, team.issueCounter)
    }
    return this.putIssue(next)
  }

  deleteIssue(id: string): void {
    if (!this.issues.delete(id)) throw new Error(`[nock] issue not found: ${id}`)
    this.nextSyncId()
    this.forgetIssue(id)
    this.emit()
    this.queuePersist()
  }

  applyRemoteIssue(issue: Issue): Issue {
    const current = this.issues.get(issue.id)
    if (current && current.syncId > issue.syncId) return current
    this.issues.set(issue.id, { ...issue, labelIds: [...issue.labelIds] })
    if (issue.syncId > this.lastSyncId) this.lastSyncId = issue.syncId
    this.repairCounters()
    this.emit()
    this.queuePersist()
    return this.issues.get(issue.id)!
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
    this.ui.propertyMenu = null
    this.emit()
  }

  clearSelection(): void {
    this.ui.selectedIssueIds = []
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
    this.emit()
  }

  togglePeek(): void {
    if (!this.ui.highlightedIssueId) return
    this.ui.peekOpen = !this.ui.peekOpen
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.emit()
  }

  openIssuePeek(id: string): void {
    this.ui.highlightedIssueId = id
    this.ui.peekOpen = true
    this.ui.commandOpen = false
    this.ui.propertyMenu = null
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
    this.ui.displayMenuOpen = false
    this.emit()
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
    this.emit()
  }

  setFilter<K extends keyof IssueFilters>(key: K, value: IssueFilters[K]): void {
    this.ui.filters = { ...this.ui.filters, [key]: value }
    this.emit()
  }

  clearFilters(): void {
    this.ui.filters = { ...EMPTY_FILTERS }
    this.emit()
  }

  toggleFilterMenu(): void {
    this.ui.filterMenuOpen = !this.ui.filterMenuOpen
    this.ui.displayMenuOpen = false
    this.ui.helpOpen = false
    this.emit()
  }

  toggleDisplayMenu(): void {
    this.ui.displayMenuOpen = !this.ui.displayMenuOpen
    this.ui.filterMenuOpen = false
    this.ui.helpOpen = false
    this.emit()
  }

  toggleHelp(): void {
    this.ui.helpOpen = !this.ui.helpOpen
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.emit()
  }

  closeMenus(): void {
    this.ui.filterMenuOpen = false
    this.ui.displayMenuOpen = false
    this.ui.helpOpen = false
    this.emit()
  }

  toggleCollapsed(stateId: string): void {
    const collapsed = new Set(this.ui.collapsedStateIds)
    if (collapsed.has(stateId)) collapsed.delete(stateId)
    else collapsed.add(stateId)
    this.ui.collapsedStateIds = [...collapsed]
    this.emit()
  }

  openComposer(fromView?: ViewId): void {
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
    this.ui.composer = {
      title: '',
      description: '',
      teamId: team.id,
      stateId,
      assigneeId: null,
      priority: 0,
      projectId: null,
      cycleId: currentCycle([...this.cycles.values()])?.id ?? null,
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
    const issue = this.createIssue({
      title,
      description: this.ui.composer.description,
      teamId: this.ui.composer.teamId,
      stateId: this.ui.composer.stateId,
      assigneeId: this.ui.composer.assigneeId,
      priority: this.ui.composer.priority,
      projectId: this.ui.composer.projectId,
      cycleId: this.ui.composer.cycleId,
    })
    this.ui.composerOpen = false
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
    this.emit()
  }

  closeCommand(): void {
    this.ui.commandOpen = false
    this.emit()
  }

  setCommandQuery(query: string): void {
    this.ui.commandQuery = query
    this.emit()
  }

  dismissOverlays(): void {
    if (this.ui.helpOpen) {
      this.ui.helpOpen = false
      this.emit()
      return
    }
    if (this.ui.displayMenuOpen) {
      this.ui.displayMenuOpen = false
      this.emit()
      return
    }
    if (this.ui.filterMenuOpen) {
      this.ui.filterMenuOpen = false
      this.emit()
      return
    }
    if (this.ui.propertyMenu) {
      this.ui.propertyMenu = null
      this.emit()
      return
    }
    if (this.ui.commandOpen) {
      this.ui.commandOpen = false
      this.emit()
      return
    }
    if (this.ui.composerOpen) {
      this.ui.composerOpen = false
      this.emit()
      return
    }
    if (this.ui.peekOpen) {
      this.ui.peekOpen = false
      this.emit()
      return
    }
    if (this.ui.selectedIssueIds.length > 0) {
      this.ui.selectedIssueIds = []
      this.emit()
      return
    }
    if (this.ui.highlightedIssueId) {
      this.ui.highlightedIssueId = null
      this.emit()
    }
  }

  openPropertyMenu(kind: PropertyMenuKind): void {
    if (this.actionIssueIds().length === 0 && !this.ui.composerOpen) return
    this.ui.propertyMenu = this.ui.propertyMenu === kind ? null : kind
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
      this.ui.propertyMenu = null
      this.emit()
      return
    }
    const ids = this.actionIssueIds()
    if (ids.length === 0) return
    const patch =
      kind === 'status'
        ? { stateId: String(value) }
        : kind === 'priority'
          ? { priority: Number(value) as Priority }
          : kind === 'assignee'
            ? { assigneeId: normalized === null ? null : String(normalized) }
            : kind === 'project'
              ? { projectId: normalized === null ? null : String(normalized) }
              : { cycleId: normalized === null ? null : String(normalized) }
    for (const issueId of ids) this.updateIssue(issueId, patch)
    this.ui.propertyMenu = null
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
    for (const issue of targets) this.updateIssue(issue.id, { stateId: defaultId })
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

  searchIssues(query: string): Issue[] {
    return [...this.issues.values()]
      .filter((issue) =>
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
      .filter((issue) => issue.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  projectProgress(projectId: string): {
    total: number
    completed: number
    ratio: number
  } {
    const issues = [...this.issues.values()].filter(
      (issue) => issue.projectId === projectId,
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
