import type { SyncBackend } from './backend'
import {
  ISSUE_ARCHIVE,
  ISSUE_CREATE,
  ISSUE_UPDATE,
  VIEWER,
} from '../graphql/operations'
import type { Issue } from '../types'
import type { SyncSubmitResult, WireCommand } from './types'

export type GraphqlFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type GraphqlClientOptions = {
  url: string
  fetch?: GraphqlFetch
  userId?: string
  workspaceId?: string
}

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message: string }>
}

type IssueNode = {
  id: string
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
  labelIds: string[]
  subscriberIds: string[]
  relatedIssueIds: string[]
  blockedByIds: string[]
  duplicateOfId: string | null
  archivedAt: number | null
  sortOrder: number
  revision: number
  lastMutationId: string | null
  createdAt: number
  updatedAt: number
}

type IssuePayload = {
  success: boolean
  clientMutationId: string
  lastSyncId?: number | null
  revision?: number | null
  error?: string | null
  issue?: IssueNode | null
}

export class GraphQLSyncBackend implements SyncBackend {
  url: string
  userId?: string
  workspaceId?: string
  private fetchImpl: GraphqlFetch

  constructor(options: GraphqlClientOptions) {
    this.url = options.url
    this.fetchImpl = options.fetch ?? fetch
    this.userId = options.userId
    this.workspaceId = options.workspaceId
  }

  async request<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphqlResponse<T>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.userId) headers['x-nock-user-id'] = this.userId
    if (this.workspaceId) headers['x-nock-workspace-id'] = this.workspaceId
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (!response.ok) {
      throw new Error(`[nock] graphql HTTP ${response.status}`)
    }
    return (await response.json()) as GraphqlResponse<T>
  }

  async submit(command: WireCommand): Promise<SyncSubmitResult> {
    if (command.kind === 'issue.delete') {
      return this.mutate('issueArchive', ISSUE_ARCHIVE, {
        clientMutationId: command.clientMutationId,
        id: command.issueId,
        expectedRevision: command.expectedRevision,
      })
    }
    if (command.snapshot && !command.patch) {
      const issue = command.snapshot
      return this.mutate('issueCreate', ISSUE_CREATE, {
        clientMutationId: command.clientMutationId,
        id: issue.id,
        teamId: issue.teamId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        stateId: issue.stateId,
        assigneeId: issue.assigneeId,
        projectId: issue.projectId,
        cycleId: issue.cycleId,
        milestoneId: issue.milestoneId,
        parentId: issue.parentId,
        sortOrder: issue.sortOrder,
        number: issue.number,
        identifier: issue.identifier,
        labelIds: issue.labelIds,
        subscriberIds: issue.subscriberIds,
      })
    }
    return this.mutate('issueUpdate', ISSUE_UPDATE, {
      clientMutationId: command.clientMutationId,
      id: command.issueId,
      ...command.patch,
    })
  }

  private async mutate(
    field: 'issueCreate' | 'issueUpdate' | 'issueArchive',
    query: string,
    input: Record<string, unknown>,
  ): Promise<SyncSubmitResult> {
    const result = await this.request<Record<string, IssuePayload>>(query, { input })
    const payload = result.data?.[field]
    if (result.errors?.length) {
      return {
        ok: false,
        clientMutationId: String(input.clientMutationId),
        error: result.errors.map((error) => error.message).join('; '),
      }
    }
    if (!payload) {
      return {
        ok: false,
        clientMutationId: String(input.clientMutationId),
        error: 'empty graphql payload',
      }
    }
    if (!payload.success) {
      return {
        ok: false,
        clientMutationId: payload.clientMutationId,
        error: payload.error || 'mutation failed',
      }
    }
    return {
      ok: true,
      clientMutationId: payload.clientMutationId,
      revision: payload.revision ?? 0,
    }
  }
}

export function issueFromGraphql(node: IssueNode): Issue {
  return {
    id: node.id,
    teamId: node.teamId,
    number: node.number,
    identifier: node.identifier,
    title: node.title,
    description: node.description,
    priority: node.priority as Issue['priority'],
    stateId: node.stateId,
    assigneeId: node.assigneeId,
    projectId: node.projectId,
    cycleId: node.cycleId,
    milestoneId: node.milestoneId,
    parentId: node.parentId,
    labelIds: [...(node.labelIds ?? [])],
    subscriberIds: [...(node.subscriberIds ?? [])],
    relatedIssueIds: [...(node.relatedIssueIds ?? [])],
    blockedByIds: [...(node.blockedByIds ?? [])],
    duplicateOfId: node.duplicateOfId,
    archivedAt: node.archivedAt,
    sortOrder: node.sortOrder,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    syncId: node.revision,
    revision: node.revision,
    lastMutationId: node.lastMutationId,
  }
}

export async function tryGraphqlBackend(
  options?: Partial<GraphqlClientOptions>,
): Promise<GraphQLSyncBackend | null> {
  const url =
    options?.url ??
    (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_GRAPHQL_URL === 'string' &&
    import.meta.env.VITE_GRAPHQL_URL
      ? import.meta.env.VITE_GRAPHQL_URL
      : '')
  if (!url) return null
  const backend = new GraphQLSyncBackend({
    url,
    fetch: options?.fetch,
    userId: options?.userId,
    workspaceId: options?.workspaceId,
  })
  try {
    const ping = await backend.request(VIEWER)
    if (ping.errors?.length || !ping.data) return null
    return backend
  } catch (error) {
    console.warn('[nock] graphql backend unavailable', error)
    return null
  }
}
