/* Generated from server/graphql/schema.graphql — run `npm run graphql:types`. */

export type Maybe<T> = T | null

export interface Query {
  viewer: Viewer
  teams: Array<Team>
  team: Team | null
  issues: IssueConnection
  issue: Issue | null
  projects: Array<Project>
  project: Project | null
  cycles: Array<Cycle>
  initiatives: Array<Initiative>
  search: SearchResult
  bootstrap: BootstrapPayload
  workspaceChanges: WorkspaceChangeConnection
}

export interface Mutation {
  issueCreate: IssuePayload
  issueUpdate: IssuePayload
  issueArchive: IssuePayload
  issueBatchUpdate: IssueBatchPayload
  commentCreate: CommentPayload
  projectCreate: ProjectPayload
  projectUpdate: ProjectPayload
}

export interface Viewer {
  id: string
  user: User
  workspace: Workspace
}

export interface Workspace {
  id: string
  name: string
  urlKey: string
  changeSequence: number
}

export interface User {
  id: string
  name: string
  email: string
  initials: string
}

export interface Team {
  id: string
  workspaceId: string
  key: string
  name: string
  issueCounter: number
  private: boolean
  cycleDurationWeeks: number
}

export interface WorkflowState {
  id: string
  workspaceId: string
  teamId: string
  name: string
  type: string
  color: string
  position: number
  isDefault: boolean
}

export interface Label {
  id: string
  workspaceId: string
  teamId: string
  name: string
  color: string
}

export interface Issue {
  id: string
  workspaceId: string
  teamId: string
  number: number
  identifier: string
  title: string
  description: string
  priority: number
  stateId: string
  assigneeId: string | null
  projectId: string | null
  cycleId: string | null
  milestoneId: string | null
  parentId: string | null
  dueAt: number | null
  labelIds: Array<string>
  subscriberIds: Array<string>
  relatedIssueIds: Array<string>
  blockedByIds: Array<string>
  duplicateOfId: string | null
  archivedAt: number | null
  sortOrder: number
  revision: number
  lastMutationId: string | null
  createdAt: number
  updatedAt: number
}

export interface IssueConnection {
  nodes: Array<Issue>
  pageInfo: PageInfo
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface Project {
  id: string
  workspaceId: string
  teamId: string
  name: string
  description: string
  summary: string
  status: string
  health: string
  area: string
  leadId: string | null
  startAt: number | null
  targetAt: number | null
  teamIds: Array<string>
  memberIds: Array<string>
  createdAt: number
  updatedAt: number
}

export interface Cycle {
  id: string
  workspaceId: string
  teamId: string
  number: number
  startsAt: number
  endsAt: number
  completedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Milestone {
  id: string
  workspaceId: string
  projectId: string
  name: string
  targetAt: number | null
  sortOrder: number
}

export interface Initiative {
  id: string
  workspaceId: string
  name: string
  description: string
  ownerId: string | null
  leadTeamId: string | null
  status: string
  priority: number
  targetAt: number | null
  projectIds: Array<string>
  createdAt: number
  updatedAt: number
}

export interface Comment {
  id: string
  workspaceId: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface SearchResult {
  issues: Array<Issue>
  projects: Array<Project>
  documents: Array<Document>
}

export interface Document {
  id: string
  workspaceId: string
  projectId: string | null
  title: string
  body: string
}

export interface BootstrapPayload {
  lastSyncId: number
  workspace: Workspace
  currentUser: User
  teams: Array<Team>
  users: Array<User>
  states: Array<WorkflowState>
  labels: Array<Label>
  projects: Array<Project>
  cycles: Array<Cycle>
  milestones: Array<Milestone>
  issues: Array<Issue>
  comments: Array<Comment>
  initiatives: Array<Initiative>
}

export interface WorkspaceChange {
  workspaceId: string
  sequence: number
  entityType: string
  entityId: string
  operation: string
  revision: number
  changedFields: Array<string>
  payload: unknown | null
  syncGroup: string | null
  authorizationTeamId: string | null
  actorId: string | null
  clientMutationId: string | null
  createdAt: number
}

export interface WorkspaceChangeConnection {
  nodes: Array<WorkspaceChange>
  pageInfo: PageInfo
  checkpoint: number
}

export interface IssuePayload {
  success: boolean
  clientMutationId: string
  issue: Issue | null
  lastSyncId: number | null
  revision: number | null
  error: string | null
}

export interface IssueBatchPayload {
  success: boolean
  clientMutationId: string
  issues: Array<Issue>
  lastSyncId: number | null
  error: string | null
}

export interface CommentPayload {
  success: boolean
  clientMutationId: string
  comment: Comment | null
  lastSyncId: number | null
  error: string | null
}

export interface ProjectPayload {
  success: boolean
  clientMutationId: string
  project: Project | null
  lastSyncId: number | null
  error: string | null
}

export interface IssueFilter {
  teamId?: string | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  query?: string | null
  includeArchived?: boolean | null
}

export interface IssueCreateInput {
  clientMutationId: string
  id?: string | null
  teamId: string
  title: string
  description?: string | null
  priority?: number | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueAt?: number | null
  sortOrder?: number | null
  number?: number | null
  identifier?: string | null
  labelIds: Array<string>
  subscriberIds: Array<string>
}

export interface IssueUpdateInput {
  clientMutationId: string
  id: string
  expectedRevision?: number | null
  title?: string | null
  description?: string | null
  priority?: number | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueAt?: number | null
  sortOrder?: number | null
  teamId?: string | null
  labelIds: Array<string>
  subscriberIds: Array<string>
  relatedIssueIds: Array<string>
  blockedByIds: Array<string>
  duplicateOfId?: string | null
}

export interface IssueArchiveInput {
  clientMutationId: string
  id: string
  expectedRevision?: number | null
}

export interface IssuePatchInput {
  id: string
  expectedRevision?: number | null
  title?: string | null
  description?: string | null
  priority?: number | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueAt?: number | null
  sortOrder?: number | null
  teamId?: string | null
  labelIds: Array<string>
  archived?: boolean | null
}

export interface IssueBatchUpdateInput {
  clientMutationId: string
  patches: Array<IssuePatchInput>
}

export interface CommentCreateInput {
  clientMutationId: string
  id?: string | null
  issueId: string
  body: string
}

export interface ProjectCreateInput {
  clientMutationId: string
  id?: string | null
  teamId: string
  name: string
  description?: string | null
  summary?: string | null
  status?: string | null
  health?: string | null
  area?: string | null
  leadId?: string | null
  startAt?: number | null
  targetAt?: number | null
  teamIds: Array<string>
}

export interface ProjectUpdateInput {
  clientMutationId: string
  id: string
  name?: string | null
  description?: string | null
  summary?: string | null
  status?: string | null
  health?: string | null
  area?: string | null
  leadId?: string | null
  startAt?: number | null
  targetAt?: number | null
  teamIds: Array<string>
}
