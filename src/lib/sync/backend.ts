import type { SyncSubmitResult, WireCommand } from './types'

export type { RemoteEvent, SyncSubmitResult, WireCommand } from './types'

export interface SyncBackend {
  submit(command: WireCommand): Promise<SyncSubmitResult>
}

export class ImmediateAckBackend implements SyncBackend {
  revision = 0
  submits: WireCommand[] = []
  applied = new Map<string, SyncSubmitResult>()
  rejectNext: string | null = null
  rejectIds = new Set<string>()

  async submit(command: WireCommand): Promise<SyncSubmitResult> {
    this.submits.push(command)
    const seen = this.applied.get(command.clientMutationId)
    if (seen) return seen
    const reject =
      this.rejectNext ||
      (this.rejectIds.has(command.issueId) ? 'rejected' : null)
    if (reject) {
      this.rejectNext = null
      const failed: SyncSubmitResult = {
        ok: false,
        clientMutationId: command.clientMutationId,
        error: reject,
      }
      this.applied.set(command.clientMutationId, failed)
      return failed
    }
    this.revision += 1
    const result: SyncSubmitResult = {
      ok: true,
      clientMutationId: command.clientMutationId,
      revision: this.revision,
    }
    this.applied.set(command.clientMutationId, result)
    return result
  }

  uniqueSubmitCount(clientMutationId: string): number {
    return this.submits.filter((row) => row.clientMutationId === clientMutationId)
      .length
  }
}

export class ScriptedBackend implements SyncBackend {
  online = true
  revision = 0
  submits: WireCommand[] = []
  applied = new Map<string, SyncSubmitResult>()
  rejectByIssue = new Map<string, string>()
  throwNext = false
  hold = false
  private waiting: Array<{
    command: WireCommand
    resolve: (result: SyncSubmitResult) => void
    reject: (error: Error) => void
  }> = []

  async submit(command: WireCommand): Promise<SyncSubmitResult> {
    this.submits.push(command)
    const seen = this.applied.get(command.clientMutationId)
    if (seen) return seen
    if (!this.online || this.throwNext) {
      this.throwNext = false
      throw new Error('network')
    }
    if (this.hold) {
      return new Promise((resolve, reject) => {
        this.waiting.push({ command, resolve, reject })
      })
    }
    return this.finish(command)
  }

  releaseHeld(): void {
    const rows = this.waiting.splice(0)
    for (const row of rows) row.resolve(this.finish(row.command))
  }

  finish(command: WireCommand): SyncSubmitResult {
    const seen = this.applied.get(command.clientMutationId)
    if (seen) return seen
    const error = this.rejectByIssue.get(command.issueId)
    if (error) {
      const failed: SyncSubmitResult = {
        ok: false,
        clientMutationId: command.clientMutationId,
        error,
      }
      this.applied.set(command.clientMutationId, failed)
      return failed
    }
    this.revision += 1
    const result: SyncSubmitResult = {
      ok: true,
      clientMutationId: command.clientMutationId,
      revision: this.revision,
    }
    this.applied.set(command.clientMutationId, result)
    return result
  }

  uniqueSubmitCount(clientMutationId: string): number {
    return this.submits.filter((row) => row.clientMutationId === clientMutationId)
      .length
  }
}
