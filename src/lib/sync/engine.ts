import type { IssuePatch } from '../commands'
import { patchFieldKeys } from '../issue-model'
import type { Issue, MutationStatus, QueuedCommand } from '../types'
import { ImmediateAckBackend, type SyncBackend } from './backend'
import type { RemoteEvent, SyncHost, SyncSubmitResult, WireCommand } from './types'

export class SyncEngine {
  store: SyncHost
  backend: SyncBackend
  online = true
  queue: QueuedCommand[] = []
  seenMutationIds = new Set<string>()
  showsSpinner = false
  private pumpChain: Promise<void> = Promise.resolve()

  constructor(store: SyncHost, backend: SyncBackend = new ImmediateAckBackend()) {
    this.store = store
    this.backend = backend
  }

  hydrate(commands: QueuedCommand[], seen: string[]): void {
    this.queue = commands.map((command) => ({
      ...command,
      status: command.status === 'sending' ? 'queued' : command.status,
    }))
    this.seenMutationIds = new Set(seen)
  }

  pending(): QueuedCommand[] {
    return this.queue.filter((command) => command.status !== 'acknowledged')
  }

  command(clientMutationId: string): QueuedCommand | undefined {
    return this.queue.find((command) => command.clientMutationId === clientMutationId)
  }

  statusForIssue(issueId: string): MutationStatus | null {
    const open = [...this.queue]
      .reverse()
      .find(
        (command) =>
          command.issueId === issueId && command.status !== 'acknowledged',
      )
    return open?.status ?? null
  }

  enqueue(input: {
    kind: QueuedCommand['kind']
    issueId: string
    patch?: IssuePatch
    snapshot?: Issue
    inverse: QueuedCommand['inverse']
    baseRevision: number
  }): QueuedCommand {
    const command: QueuedCommand = {
      clientMutationId: crypto.randomUUID(),
      kind: input.kind,
      issueId: input.issueId,
      patch: input.patch,
      snapshot: input.snapshot,
      inverse: input.inverse,
      status: 'queued',
      baseRevision: input.baseRevision,
      createdAt: Date.now(),
    }
    this.queue.push(command)
    return command
  }

  setOnline(online: boolean): void {
    this.online = online
    if (online) void this.pump()
  }

  async reconnect(): Promise<void> {
    this.online = true
    await this.pump()
  }

  retry(clientMutationId?: string): void {
    const targets = this.queue.filter((command) => {
      if (clientMutationId) return command.clientMutationId === clientMutationId
      return command.status === 'failed' || command.status === 'queued'
    })
    for (const command of targets) {
      if (command.status === 'acknowledged') continue
      command.status = 'queued'
      command.error = undefined
    }
    void this.pump()
  }

  pump(): Promise<void> {
    this.pumpChain = this.pumpChain.then(() => this.drain())
    return this.pumpChain
  }

  applyRemote(event: RemoteEvent): 'applied' | 'duplicate' | 'conflict' {
    if (this.seenMutationIds.has(event.mutationId)) return 'duplicate'
    const own = this.command(event.mutationId)
    if (own) {
      this.seenMutationIds.add(event.mutationId)
      own.status = 'acknowledged'
      const issue = this.store.issue(event.issueId)
      if (issue) {
        this.store.writeEntity({
          ...issue,
          revision: event.revision,
          syncId: event.revision,
          lastMutationId: event.mutationId,
        })
      }
      this.store.lastSyncId = Math.max(this.store.lastSyncId, event.revision)
      this.store.queuePersist()
      this.store.bump()
      return 'applied'
    }

    this.seenMutationIds.add(event.mutationId)

    if (event.deleted) {
      const pending = this.queue.filter(
        (command) =>
          command.issueId === event.issueId && command.status !== 'acknowledged',
      )
      for (const command of pending) {
        command.status = 'conflict'
        command.error = 'Issue was deleted remotely'
      }
      if (this.store.issue(event.issueId)) {
        this.store.removeEntity(event.issueId)
      }
      this.store.lastSyncId = Math.max(this.store.lastSyncId, event.revision)
      this.store.queuePersist()
      this.store.bump()
      return pending.length ? 'conflict' : 'applied'
    }

    const current = this.store.issue(event.issueId)
    const incoming = event.issue
      ? { ...event.issue }
      : current && event.patch
        ? { ...current, ...event.patch }
        : undefined
    if (!incoming) return 'applied'

    if (!current) {
      this.store.writeEntity({
        ...incoming,
        revision: event.revision,
        syncId: event.revision,
        lastMutationId: event.mutationId,
      })
      this.store.lastSyncId = Math.max(this.store.lastSyncId, event.revision)
      this.store.queuePersist()
      this.store.bump()
      return 'applied'
    }

    if (event.revision < current.revision) {
      return 'duplicate'
    }

    const pendingFields = this.openFields(event.issueId)
    const remotePatch = event.patch ?? pickRemotePatch(current, incoming)
    let conflict = false
    const next = { ...current }
    for (const key of patchFieldKeys(remotePatch)) {
      if (pendingFields.has(key)) {
        conflict = true
        this.markFieldConflict(event.issueId, key)
        continue
      }
      ;(next as Record<string, unknown>)[key] = (incoming as Record<string, unknown>)[key]
    }
    next.revision = Math.max(current.revision, event.revision)
    next.syncId = next.revision
    next.lastMutationId = event.mutationId
    this.store.writeEntity(next)
    this.store.lastSyncId = Math.max(this.store.lastSyncId, event.revision)
    this.store.queuePersist()
    this.store.bump()
    return conflict ? 'conflict' : 'applied'
  }

  private async drain(): Promise<void> {
    if (!this.online) return
    while (this.online) {
      const next = this.queue.find((command) => command.status === 'queued')
      if (!next) return
      next.status = 'sending'
      this.store.bump()
      const wire: WireCommand = {
        clientMutationId: next.clientMutationId,
        kind: next.kind,
        issueId: next.issueId,
        patch: next.patch,
        snapshot: next.snapshot,
      }
      try {
        const result = await this.backend.submit(wire)
        this.applySubmitResult(next, result)
      } catch (error) {
        next.status = 'queued'
        next.error = error instanceof Error ? error.message : String(error)
        this.store.queuePersist()
        this.store.bump()
        return
      }
    }
  }

  private applySubmitResult(command: QueuedCommand, result: SyncSubmitResult): void {
    this.seenMutationIds.add(command.clientMutationId)
    if (!result.ok) {
      command.status = 'failed'
      command.error = result.error
      this.store.applyInversePatch(command.inverse, command.issueId)
      this.store.queuePersist()
      this.store.bump()
      return
    }
    command.status = 'acknowledged'
    const revision = Math.max(result.revision, this.store.lastSyncId + 1)
    const issue = this.store.issue(command.issueId)
    if (issue) {
      this.store.writeEntity({
        ...issue,
        revision,
        syncId: revision,
        lastMutationId: command.clientMutationId,
      })
    }
    this.store.lastSyncId = Math.max(this.store.lastSyncId, revision)
    this.store.queuePersist()
    this.store.bump()
  }

  private openFields(issueId: string): Set<string> {
    const fields = new Set<string>()
    for (const command of this.queue) {
      if (command.issueId !== issueId) continue
      if (command.status === 'acknowledged' || command.status === 'failed') continue
      if (command.kind === 'issue.delete') {
        fields.add('*')
        continue
      }
      if (command.patch) {
        for (const key of patchFieldKeys(command.patch)) fields.add(key)
      }
    }
    return fields
  }

  private markFieldConflict(issueId: string, field: string): void {
    for (const command of this.queue) {
      if (command.issueId !== issueId) continue
      if (command.status === 'acknowledged') continue
      const keys = command.patch ? patchFieldKeys(command.patch) : []
      if (command.kind === 'issue.delete' || keys.includes(field)) {
        command.status = 'conflict'
        command.error = `Remote update to ${field}`
      }
    }
  }
}

function pickRemotePatch(current: Issue, incoming: Issue): IssuePatch {
  const patch: IssuePatch = {}
  for (const key of patchFieldKeys(incoming)) {
    const left = current[key as keyof Issue]
    const right = incoming[key as keyof Issue]
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      ;(patch as Record<string, unknown>)[key] = right
    }
  }
  return patch
}
