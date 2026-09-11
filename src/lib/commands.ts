import type { CreateIssueInput, Priority, PropertyMenuKind, ViewId } from './types'

export type IssuePatch = Partial<{
  title: string
  description: string
  priority: Priority
  stateId: string
  assigneeId: string | null
  projectId: string | null
  cycleId: string | null
  labelIds: string[]
  sortOrder: number
  parentId: string | null
  teamId: string
}>

export type DomainCommand =
  | { type: 'issue.create'; input: CreateIssueInput }
  | { type: 'issue.update'; id: string; patch: IssuePatch }
  | { type: 'issue.setProperty'; kind: PropertyMenuKind; value: string | number | null }
  | { type: 'issue.acceptTriage'; view?: ViewId }
  | { type: 'issue.declineTriage'; view?: ViewId }
  | { type: 'issue.moveToState'; id: string; stateId: string }

export type CommandResult =
  | { ok: true; issueId?: string }
  | { ok: false; error: string }

export function commandError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
