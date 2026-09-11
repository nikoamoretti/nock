import { boardColumns, currentCycle, filterIssues, fuzzyMatch } from './filters'
import { formatIdentifier } from './identifiers'
import { MemoryPersistence, type Persistence } from './persist'
import { createBootstrapSnapshot, IDS } from './seed'
import type {
  CreateIssueInput,
  Cycle,
  Issue,
  Label,
  Priority,
  Project,
  PropertyMenuKind,
  Snapshot,
  Team,
  UiState,
  User,
  ViewId,
  WorkflowState,
  Workspace,
} from './types'

function defaultUi(snapshot: Snapshot): UiState {
  const team = snapshot.teams[0]
  const defaultState =
    snapshot.states.find((state) => state.isDefault && state.teamId === team.id) ??
    snapshot.states[0]
  return {
    selectedIssueId: null,
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
    const snapshot = loaded ?? createBootstrapSnapshot({ demo: true })
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
      snapshot.projects.map((project) => [project.id, { ...project }]),
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

  stateById(id: string): WorkflowState {
    const state = this.states.get(id)
    if (!state) throw new Error(`[nock] state not found: ${id}`)
    return state
  }

  issue(id: string): Issue | undefined {
    return this.issues.get(id)
  }

  selectedIssue(): Issue | undefined {
    return this.ui.selectedIssueId
      ? this.issues.get(this.ui.selectedIssueId)
      : undefined
  }

  issueByIdentifier(identifier: string): Issue | undefined {
    const needle = identifier.trim().toUpperCase()
    return [...this.issues.values()].find((issue) => issue.identifier === needle)
  }

  issuesForView(view: ViewId): Issue[] {
    return filterIssues(this.serialize(), view)
  }

  boardStates(): WorkflowState[] {
    return boardColumns(this.statesForTeam(this.defaultTeam().id))
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
    if (this.ui.selectedIssueId === id) this.ui.selectedIssueId = null
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

  selectIssue(id: string | null): void {
    this.ui.selectedIssueId = id
    this.ui.propertyMenu = null
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
    this.ui.selectedIssueId = issue.id
    this.emit()
    return issue
  }

  openCommand(): void {
    this.ui.commandOpen = true
    this.ui.composerOpen = false
    this.ui.commandQuery = ''
    this.ui.propertyMenu = null
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
    if (this.ui.selectedIssueId) {
      this.ui.selectedIssueId = null
      this.emit()
    }
  }

  openPropertyMenu(kind: PropertyMenuKind): void {
    if (!this.ui.selectedIssueId && !this.ui.composerOpen) return
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
    const issueId = this.ui.selectedIssueId
    if (!issueId) return
    if (kind === 'status') this.updateIssue(issueId, { stateId: String(value) })
    if (kind === 'priority')
      this.updateIssue(issueId, { priority: Number(value) as Priority })
    if (kind === 'assignee')
      this.updateIssue(issueId, {
        assigneeId: normalized === null ? null : String(normalized),
      })
    if (kind === 'project')
      this.updateIssue(issueId, {
        projectId: normalized === null ? null : String(normalized),
      })
    if (kind === 'cycle')
      this.updateIssue(issueId, {
        cycleId: normalized === null ? null : String(normalized),
      })
    this.ui.propertyMenu = null
    this.emit()
  }

  selectRelative(view: ViewId, delta: number): void {
    const issues = this.issuesForView(view)
    if (issues.length === 0) return
    const index = issues.findIndex((issue) => issue.id === this.ui.selectedIssueId)
    const nextIndex = Math.min(
      issues.length - 1,
      Math.max(0, (index < 0 ? (delta > 0 ? -1 : 0) : index) + delta),
    )
    this.selectIssue(issues[nextIndex].id)
  }

  searchIssues(query: string): Issue[] {
    return [...this.issues.values()]
      .filter((issue) =>
        fuzzyMatch(query, `${issue.identifier} ${issue.title}`),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
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
    this.hydrate(createBootstrapSnapshot({ demo: true }))
    this.emit()
    this.queuePersist()
    await this.flush()
  }
}

export type { Persistence }
export { MemoryPersistence }
