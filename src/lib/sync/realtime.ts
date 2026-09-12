import { issueFromGraphql, type GraphQLSyncBackend } from './graphql-backend'
import type { NockStore } from '../store'
import type { Issue } from '../types'
import type { RemoteEvent } from './types'

export type WorkspaceChange = {
  workspaceId: string
  sequence: number
  entityType: string
  entityId: string
  operation: string
  revision: number
  changedFields: string[]
  payload: unknown
  syncGroup?: string | null
  authorizationTeamId?: string | null
  actorId?: string | null
  clientMutationId?: string | null
  createdAt: number
}

export type DeltaPage = {
  nodes: WorkspaceChange[]
  hasNextPage: boolean
  checkpoint: number
}

export type LiveMessage =
  | { type: 'change'; change: WorkspaceChange }
  | { type: 'revoke'; teamId: string }
  | { type: 'hello'; checkpoint: number }

export type ConnectionState = 'offline' | 'connecting' | 'live' | 'reconnecting'

export type RealtimeOptions = {
  fetchDelta: (after: number, first?: number) => Promise<DeltaPage>
  connect?: (push: (message: LiveMessage) => void) => Promise<() => void>
  pageSize?: number
}

export class RealtimeClient {
  store: NockStore
  connection: ConnectionState = 'offline'
  private options: RealtimeOptions
  private unsubscribe: (() => void) | null = null
  private catchUpChain: Promise<void> = Promise.resolve()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  applied: number[] = []

  constructor(store: NockStore, options: RealtimeOptions) {
    this.store = store
    this.options = options
  }

  async connect(): Promise<void> {
    this.clearReconnect()
    this.connection = this.connection === 'offline' ? 'connecting' : 'reconnecting'
    this.store.sync.connection = this.connection
    this.store.bump()
    this.unsubscribe?.()
    this.unsubscribe = null
    try {
      if (this.options.connect) {
        this.unsubscribe = await this.options.connect((message) => {
          void this.onMessage(message)
        })
      }
      await this.catchUp()
      this.connection = 'live'
      this.store.sync.connection = 'live'
      this.reconnectAttempt = 0
      this.store.bump()
    } catch (error) {
      console.warn('[nock] live connect failed', error)
      this.connection = 'reconnecting'
      this.store.sync.connection = 'reconnecting'
      this.store.bump()
      this.scheduleReconnect()
    }
  }

  pause(): void {
    this.clearReconnect()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.connection = 'reconnecting'
    this.store.sync.connection = 'reconnecting'
    this.store.bump()
  }

  disconnect(): void {
    this.clearReconnect()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.connection = 'offline'
    this.store.sync.connection = 'offline'
    this.store.bump()
  }

  async onMessage(message: LiveMessage): Promise<void> {
    if (message.type === 'revoke') {
      this.dropTeam(message.teamId)
      return
    }
    if (message.type === 'hello') return
    await this.applyChange(message.change)
  }

  applyChange(change: WorkspaceChange): 'applied' | 'duplicate' | 'gap' | 'conflict' {
    if (change.sequence <= this.store.lastSyncId) return 'duplicate'
    if (change.sequence > this.store.lastSyncId + 1) {
      void this.catchUp()
      return 'gap'
    }
    const remote = toRemoteEvent(change)
    let outcome: 'applied' | 'duplicate' | 'conflict' = 'applied'
    if (remote) outcome = this.store.sync.applyRemote(remote)
    this.store.lastSyncId = change.sequence
    this.applied.push(change.sequence)
    this.store.queuePersist()
    this.store.bump()
    return outcome
  }

  catchUp(): Promise<void> {
    this.catchUpChain = this.catchUpChain.then(() => this.drainDelta())
    return this.catchUpChain
  }

  private async drainDelta(): Promise<void> {
    const pageSize = this.options.pageSize ?? 500
    let guard = 0
    while (guard < 10_000) {
      guard += 1
      const page = await this.options.fetchDelta(this.store.lastSyncId, pageSize)
      if (page.nodes.length === 0) return
      for (const change of page.nodes) {
        if (change.sequence <= this.store.lastSyncId) continue
        if (change.sequence > this.store.lastSyncId + 1) {
          console.warn('[nock] sync gap during catch-up', {
            have: this.store.lastSyncId,
            next: change.sequence,
          })
          return
        }
        this.applyChange(change)
      }
      if (!page.hasNextPage) return
    }
  }

  dropTeam(teamId: string): void {
    for (const issue of [...this.store.issues.values()]) {
      if (issue.teamId === teamId) this.store.removeEntity(issue.id)
    }
    this.store.queuePersist()
    this.store.bump()
  }

  private scheduleReconnect(): void {
    if (this.connection === 'offline') return
    this.reconnectAttempt += 1
    const delay = Math.min(8000, 250 * 2 ** Math.min(this.reconnectAttempt, 5))
    this.reconnectTimer = setTimeout(() => {
      void this.connect()
    }, delay)
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }
}

export function graphqlWsUrl(graphqlUrl: string, origin = 'http://127.0.0.1:8787'): string {
  const base =
    typeof location !== 'undefined' && location.origin ? location.origin : origin
  const url = new URL(graphqlUrl, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = url.pathname.replace(/\/graphql\/?$/, '/sync')
  if (!url.pathname.endsWith('/sync')) url.pathname = '/sync'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function asWorkspaceChange(row: Record<string, unknown>): WorkspaceChange {
  return {
    workspaceId: String(row.workspaceId ?? row.workspace_id ?? ''),
    sequence: Number(row.sequence ?? 0),
    entityType: String(row.entityType ?? row.entity_type ?? ''),
    entityId: String(row.entityId ?? row.entity_id ?? ''),
    operation: String(row.operation ?? 'update'),
    revision: Number(row.revision ?? 0),
    changedFields: Array.isArray(row.changedFields)
      ? row.changedFields.map(String)
      : Array.isArray(row.changed_fields)
        ? row.changed_fields.map(String)
        : [],
    payload: row.payload,
    syncGroup: (row.syncGroup ?? row.sync_group ?? null) as string | null,
    authorizationTeamId: (row.authorizationTeamId ??
      row.authorization_team_id ??
      null) as string | null,
    actorId: (row.actorId ?? row.actor_id ?? null) as string | null,
    clientMutationId: (row.clientMutationId ?? row.client_mutation_id ?? null) as
      | string
      | null,
    createdAt: Number(row.createdAt ?? row.created_at ?? Date.now()),
  }
}

export function attachGraphqlRealtime(
  store: NockStore,
  backend: GraphQLSyncBackend,
): RealtimeClient {
  const client = new RealtimeClient(store, {
    fetchDelta: async (after, first) => {
      const page = await backend.fetchDelta(after, first)
      return {
        nodes: page.nodes.map((row) => asWorkspaceChange(row)),
        hasNextPage: page.hasNextPage,
        checkpoint: page.checkpoint,
      }
    },
    connect: openLiveSocket({
      wsUrl: graphqlWsUrl(backend.url),
      userId: backend.userId ?? store.currentUserId,
      workspaceId: backend.workspaceId ?? store.workspace.id,
      getCheckpoint: () => store.lastSyncId,
      onDrop: () => {
        if (client.connection === 'offline') return
        client.pause()
        void client.connect()
      },
    }),
  })
  return client
}

export function openLiveSocket(options: {
  wsUrl: string
  userId: string
  workspaceId: string
  getCheckpoint: () => number
  onDrop?: () => void
}): (push: (message: LiveMessage) => void) => Promise<() => void> {
  return (push) =>
    new Promise((resolve, reject) => {
      const url = `${options.wsUrl}?userId=${encodeURIComponent(options.userId)}&workspaceId=${encodeURIComponent(options.workspaceId)}&checkpoint=${options.getCheckpoint()}`
      const ws = new WebSocket(url)
      let stopped = false
      const timer = setTimeout(() => {
        ws.close()
        reject(new Error(`[nock] live socket timeout ${url}`))
      }, 8000)
      const onOpen = () => {
        clearTimeout(timer)
        resolve(() => {
          stopped = true
          ws.close()
        })
      }
      ws.addEventListener('open', onOpen)
      ws.addEventListener('message', (event) => {
        try {
          const data = (event as MessageEvent).data
          push(JSON.parse(String(data)) as LiveMessage)
        } catch (error) {
          console.warn('[nock] live message ignored', error)
        }
      })
      ws.addEventListener('close', () => {
        clearTimeout(timer)
        if (stopped) return
        options.onDrop?.()
      })
      ws.addEventListener('error', () => {
        console.warn('[nock] live socket error', url)
      })
    })
}

export function toRemoteEvent(change: WorkspaceChange): RemoteEvent | null {
  const mutationId = change.clientMutationId || `seq:${change.sequence}`
  if (change.entityType !== 'issue') return null
  if (change.operation === 'delete' || change.operation === 'archive') {
    return {
      mutationId,
      revision: change.revision,
      sequence: change.sequence,
      issueId: change.entityId,
      deleted: change.operation === 'delete',
    }
  }
  const issue = issueFromChangePayload(change.entityId, change.payload)
  const star = change.changedFields.includes('*') || change.changedFields.length === 0
  const patch = issue && !star
    ? Object.fromEntries(
        change.changedFields
          .filter((key) => key in issue)
          .map((key) => [key, issue[key as keyof Issue]]),
      )
    : issue
  return {
    mutationId,
    revision: change.revision,
    sequence: change.sequence,
    issueId: change.entityId,
    issue: issue ?? undefined,
    patch: patch ?? undefined,
  }
}

function issueFromChangePayload(id: string, payload: unknown): Issue | undefined {
  let data = payload
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload)
    } catch (error) {
      console.warn('[nock] change payload is not JSON', error)
      return undefined
    }
  }
  if (!data || typeof data !== 'object') return undefined
  const row = data as Record<string, unknown>
  return issueFromGraphql({
    id: String(row.id ?? id),
    teamId: String(row.teamId ?? row.team_id ?? ''),
    number: Number(row.number ?? 0),
    identifier: String(row.identifier ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    priority: Number(row.priority ?? 0),
    stateId: String(row.stateId ?? row.state_id ?? ''),
    assigneeId: (row.assigneeId ?? row.assignee_id ?? null) as string | null,
    projectId: (row.projectId ?? row.project_id ?? null) as string | null,
    cycleId: (row.cycleId ?? row.cycle_id ?? null) as string | null,
    milestoneId: (row.milestoneId ?? row.milestone_id ?? null) as string | null,
    parentId: (row.parentId ?? row.parent_id ?? null) as string | null,
    labelIds: Array.isArray(row.labelIds)
      ? row.labelIds.map(String)
      : Array.isArray(row.label_ids)
        ? row.label_ids.map(String)
        : [],
    subscriberIds: Array.isArray(row.subscriberIds)
      ? row.subscriberIds.map(String)
      : [],
    relatedIssueIds: Array.isArray(row.relatedIssueIds)
      ? row.relatedIssueIds.map(String)
      : [],
    blockedByIds: Array.isArray(row.blockedByIds)
      ? row.blockedByIds.map(String)
      : [],
    duplicateOfId: (row.duplicateOfId ?? row.duplicate_of_id ?? null) as string | null,
    archivedAt: (row.archivedAt ?? row.archived_at ?? null) as number | null,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    revision: Number(row.revision ?? 0),
    lastMutationId: (row.lastMutationId ?? row.last_mutation_id ?? null) as string | null,
    createdAt: Number(row.createdAt ?? row.created_at ?? Date.now()),
    updatedAt: Number(row.updatedAt ?? row.updated_at ?? Date.now()),
  })
}
