import type { InboxNotification } from './inbox'
import type { ExternalLink } from './integrations'
import type {
  Cycle,
  Initiative,
  Issue,
  IssueComment,
  Label,
  Milestone,
  PlanningDocument,
  Project,
  ProjectUpdate,
  SavedView,
  Team,
  User,
  WorkflowState,
  Workspace,
} from './types'

export type EntityMaps = {
  workspaces: Map<string, Workspace>
  users: Map<string, User>
  teams: Map<string, Team>
  workflowStates: Map<string, WorkflowState>
  labels: Map<string, Label>
  issues: Map<string, Issue>
  comments: Map<string, IssueComment>
  projects: Map<string, Project>
  projectUpdates: Map<string, ProjectUpdate>
  milestones: Map<string, Milestone>
  cycles: Map<string, Cycle>
  initiatives: Map<string, Initiative>
  documents: Map<string, PlanningDocument>
  notifications: Map<string, InboxNotification>
  customerRequests: Map<string, import('./triage').CustomerRequest>
  externalLinks: Map<string, ExternalLink>
  savedViews: Map<string, SavedView>
}
