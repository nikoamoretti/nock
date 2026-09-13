export type StateType =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled'
  | 'duplicate'

export type Priority = 0 | 1 | 2 | 3 | 4

export type ProjectStatus = 'planned' | 'started' | 'completed' | 'canceled'

export type ProjectHealth = 'on-track' | 'at-risk' | 'off-track' | 'no-update'

export type ViewId =
  | 'inbox'
  | 'my-issues'
  | 'all'
  | 'active'
  | 'backlog'
  | 'board'
  | 'projects'
  | 'cycles'
  | 'initiatives'

export type Layout = 'list' | 'board'

export type GroupBy = 'status' | 'priority' | 'assignee' | 'project' | 'cycle' | 'none'

export type OrderBy = 'status' | 'priority' | 'updated' | 'created' | 'manual'

export type FilterField =
  | 'assigneeId'
  | 'stateId'
  | 'priority'
  | 'projectId'
  | 'cycleId'
  | 'labelId'

export type FilterOp = 'eq' | 'neq'

export type FilterClause = {
  field: FilterField
  op: FilterOp
  value: string | number | null
}

export type FilterAst =
  | { type: 'all' }
  | { type: 'and'; nodes: FilterAst[] }
  | { type: 'or'; nodes: FilterAst[] }
  | { type: 'clause'; clause: FilterClause }

export type DisplayProperty =
  | 'id'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'project'
  | 'cycle'
  | 'labels'

export interface IssueFilters {
  assigneeId: string | null
  stateId: string | null
  priority: Priority | null
  projectId: string | null
  cycleId: string | null
}

export const FILTER_UNASSIGNED = '__unassigned__'

export const DEFAULT_DISPLAY_PROPERTIES: DisplayProperty[] = [
  'id',
  'status',
  'assignee',
  'priority',
  'project',
  'cycle',
  'labels',
]

export interface Workspace {
  id: string
  name: string
  urlKey: string
}

export interface Team {
  id: string
  key: string
  name: string
  issueCounter: number
  cycleDurationWeeks?: number
}

export interface User {
  id: string
  name: string
  email: string
  initials: string
}

export interface WorkflowState {
  id: string
  teamId: string
  name: string
  type: StateType
  color: string
  position: number
  isDefault: boolean
}

export interface Label {
  id: string
  teamId: string
  name: string
  color: string
}

export interface Project {
  id: string
  teamId: string
  name: string
  description: string
  summary: string
  status: ProjectStatus
  area: string
  health: ProjectHealth
  leadId: string | null
  startAt: number | null
  targetAt: number | null
  teamIds: string[]
  memberIds: string[]
  blockedByIds: string[]
  createdAt: number
  updatedAt: number
  syncId: number
}

export interface ProjectUpdate {
  id: string
  projectId: string
  authorId: string
  health: ProjectHealth
  body: string
  createdAt: number
  syncId: number
}

export interface Cycle {
  id: string
  teamId: string
  number: number
  startsAt: number
  endsAt: number
  completedAt: number | null
  scopeIssueIds: string[]
  createdAt: number
  updatedAt: number
  syncId: number
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  sortOrder: number
  targetAt: number | null
}

export interface Initiative {
  id: string
  name: string
  description: string
  ownerId: string | null
  leadTeamId: string | null
  status: ProjectStatus
  priority: Priority
  targetAt: number | null
  projectIds: string[]
  createdAt: number
  updatedAt: number
}

export interface PlanningDocument {
  id: string
  projectId: string | null
  initiativeId: string | null
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface Issue {
  id: string
  teamId: string
  number: number
  identifier: string
  title: string
  description: string
  priority: Priority
  stateId: string
  assigneeId: string | null
  projectId: string | null
  milestoneId: string | null
  cycleId: string | null
  labelIds: string[]
  parentId: string | null
  subscriberIds: string[]
  relatedIssueIds: string[]
  blockedByIds: string[]
  duplicateOfId: string | null
  archivedAt: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  syncId: number
  revision: number
  lastMutationId: string | null
}

export interface IssueComment {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
}

export interface IssueActivity {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
}

export interface IssueLink {
  id: string
  issueId: string
  url: string
  title: string
}

export interface SavedView {
  id: string
  name: string
  view: ViewId
  layout: Layout
  groupBy: GroupBy
  subgroupBy: GroupBy
  orderBy: OrderBy
  displayProperties: DisplayProperty[]
  filters: IssueFilters
  ast: FilterAst
  combine: 'and' | 'or'
}

export type MutationStatus =
  | 'queued'
  | 'sending'
  | 'acknowledged'
  | 'failed'
  | 'conflict'

export type InversePatch =
  | { type: 'patch'; patch: Partial<Issue> }
  | { type: 'delete' }
  | { type: 'restore'; issue: Issue }

export type QueuedCommand = {
  clientMutationId: string
  kind: 'issue.upsert' | 'issue.delete'
  issueId: string
  patch?: Partial<Issue>
  snapshot?: Issue
  inverse: InversePatch
  status: MutationStatus
  baseRevision: number
  createdAt: number
  error?: string
}

export type ViewQuery = {
  view: ViewId
  filters: IssueFilters
}

export interface Snapshot {
  lastSyncId: number
  workspace: Workspace
  currentUserId: string
  teams: Team[]
  users: User[]
  states: WorkflowState[]
  labels: Label[]
  projects: Project[]
  cycles: Cycle[]
  milestones: Milestone[]
  initiatives: Initiative[]
  documents: PlanningDocument[]
  issues: Issue[]
  projectUpdates: ProjectUpdate[]
  comments: IssueComment[]
  activities: IssueActivity[]
  attachments: IssueLink[]
  savedViews: SavedView[]
  notifications?: import('./inbox').InboxNotification[]
  triageRules?: import('./triage').TriageRule[]
  customerRequests?: import('./triage').CustomerRequest[]
  snoozes?: Record<string, number>
  inboxDelivery?: import('./inbox').DeliveryPreferences
  installations?: import('./integrations').IntegrationInstallation[]
  externalLinks?: import('./integrations').ExternalLink[]
  externalIdentities?: import('./integrations').ExternalIdentity[]
  pendingCommands: QueuedCommand[]
  seenMutationIds: string[]
}

export interface CreateIssueInput {
  title: string
  description?: string
  teamId?: string
  stateId?: string
  assigneeId?: string | null
  priority?: Priority
  projectId?: string | null
  milestoneId?: string | null
  cycleId?: string | null
  labelIds?: string[]
  parentId?: string | null
}

export type PropertyMenuKind =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'project'
  | 'cycle'
  | 'label'
  | 'milestone'
  | 'team'
  | 'duplicate'

export interface UiState {
  highlightedIssueId: string | null
  selectedIssueIds: string[]
  peekOpen: boolean
  layout: Layout
  groupBy: GroupBy
  subgroupBy: GroupBy
  orderBy: OrderBy
  displayProperties: DisplayProperty[]
  filters: IssueFilters
  filterAst: FilterAst
  filterCombine: 'and' | 'or'
  savedViewId: string | null
  pickerQuery: string
  collectionRestore: CollectionRestore | null
  pendingListScroll: number | null
  listScrollTop: number
  drag: BoardDrag | null
  filterMenuOpen: boolean
  displayMenuOpen: boolean
  helpOpen: boolean
  composerOpen: boolean
  commandOpen: boolean
  commandQuery: string
  searchOpen: boolean
  searchQuery: string
  searchError: string | null
  routeTeamKey: string | null
  propertyMenu: PropertyMenuKind | null
  inboxPane: 'triage' | 'priority' | 'other'
  highlightedNotificationId: string | null
  collapsedStateIds: string[]
  selectionAnchorId: string | null
  modalStack: OverlayId[]
  composer: {
    title: string
    description: string
    teamId: string
    stateId: string
    assigneeId: string | null
    priority: Priority
    projectId: string | null
    milestoneId: string | null
    cycleId: string | null
    parentId: string | null
    labelIds: string[]
  }
}

export type OverlayId =
  | 'help'
  | 'display'
  | 'filter'
  | 'property'
  | 'command'
  | 'search'
  | 'composer'
  | 'peek'

export type CollectionRestore = {
  pathname: string
  search: string
  scrollTop: number
  highlightId: string | null
  selectedIds: string[]
}

export type BoardDrag = {
  issueIds: string[]
  fromStateId: string
  overStateId: string | null
  overIndex: number | null
}

export const EMPTY_FILTERS: IssueFilters = {
  assigneeId: null,
  stateId: null,
  priority: null,
  projectId: null,
  cycleId: null,
}

export const EMPTY_AST: FilterAst = { type: 'all' }

export const STATE_TYPE_ORDER: StateType[] = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
  'duplicate',
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'off-track': 'Off track',
  'no-update': 'No update',
}

export const PRIORITY_RANK: Record<Priority, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  0: 4,
}
