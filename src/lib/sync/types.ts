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
  expectedRevision?: number
}

export type SyncSubmitResult =
  | { ok: true; clientMutationId: string; revision: number; lastSyncId?: number }
  | { ok: false; clientMutationId: string; error: string }

export type RemoteEvent = {
  mutationId: string
  revision: number
  sequence?: number
  issueId: string
  patch?: IssuePatch
  issue?: Issue
  deleted?: boolean
}

export type ConnectionState = 'offline' | 'connecting' | 'live' | 'reconnecting'
