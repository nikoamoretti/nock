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

export type ViewId =
  | 'inbox'
  | 'my-issues'
  | 'all'
  | 'active'
  | 'backlog'
  | 'board'
  | 'projects'
  | 'cycles'

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
  status: ProjectStatus
  createdAt: number
  updatedAt: number
  syncId: number
}

export interface Cycle {
  id: string
  teamId: string
  number: number
  startsAt: number
  endsAt: number
  createdAt: number
  updatedAt: number
  syncId: number
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
  cycleId: string | null
  labelIds: string[]
  parentId: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  syncId: number
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
  issues: Issue[]
}

export interface CreateIssueInput {
  title: string
  description?: string
  teamId?: string
  stateId?: string
  assigneeId?: string | null
  priority?: Priority
  projectId?: string | null
  cycleId?: string | null
  labelIds?: string[]
}

export type PropertyMenuKind = 'status' | 'priority' | 'assignee' | 'project' | 'cycle'

export interface UiState {
  selectedIssueId: string | null
  composerOpen: boolean
  commandOpen: boolean
  commandQuery: string
  propertyMenu: PropertyMenuKind | null
  collapsedStateIds: string[]
  composer: {
    title: string
    description: string
    teamId: string
    stateId: string
    assigneeId: string | null
    priority: Priority
    projectId: string | null
    cycleId: string | null
  }
}

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

export const PRIORITY_RANK: Record<Priority, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  0: 4,
}
