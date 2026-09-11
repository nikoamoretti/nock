import type { IssuePatch } from '../commands'
import type { InversePatch, Issue, QueuedCommand } from '../types'

export type SyncHost = {
  lastSyncId: number
  issue(id: string): Issue | undefined
  writeEntity(issue: Issue): void
  removeEntity(id: string): void
  applyInversePatch(inverse: InversePatch, issueId: string): void
  queuePersist(): void
  bump(): void
}

export type WireCommand = {
  clientMutationId: string
  kind: QueuedCommand['kind']
  issueId: string
  patch?: IssuePatch
  snapshot?: Issue
}

export type SyncSubmitResult =
  | { ok: true; clientMutationId: string; revision: number }
  | { ok: false; clientMutationId: string; error: string }

export type RemoteEvent = {
  mutationId: string
  revision: number
  issueId: string
  patch?: IssuePatch
  issue?: Issue
  deleted?: boolean
}
