import { describe, expect, it } from 'vitest'
import { graphqlWsUrl, toRemoteEvent, type WorkspaceChange } from './realtime'

function change(over: Partial<WorkspaceChange> & { payload?: unknown }): WorkspaceChange {
  return {
    workspaceId: 'ws_acme',
    sequence: 4,
    entityType: 'issue',
    entityId: 'iss_1',
    operation: 'update',
    revision: 2,
    changedFields: ['description'],
    payload: {
      id: 'iss_1',
      teamId: 'team_eng',
      number: 1,
      identifier: 'ENG-1',
      title: 'Local title',
      description: 'from server',
      priority: 0,
      stateId: 'todo',
      labelIds: [],
      subscriberIds: [],
      relatedIssueIds: [],
      blockedByIds: [],
      sortOrder: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 2,
    },
    clientMutationId: 'm-1',
    createdAt: 1,
    ...over,
  }
}

describe('realtime helpers', () => {
  it('derives the /sync websocket URL from a GraphQL HTTP URL', () => {
    expect(graphqlWsUrl('http://127.0.0.1:8787/graphql')).toBe('ws://127.0.0.1:8787/sync')
    expect(graphqlWsUrl('/graphql', 'http://127.0.0.1:5173')).toBe('ws://127.0.0.1:5173/sync')
  })

  it('patches only changed fields and parses JSON string payloads', () => {
    const remote = toRemoteEvent(change({}))
    expect(remote?.patch).toEqual({ description: 'from server' })
    const fromString = toRemoteEvent(
      change({
        payload: JSON.stringify({
          id: 'iss_1',
          teamId: 'team_eng',
          number: 1,
          identifier: 'ENG-1',
          title: 'After drop',
          description: '',
          priority: 0,
          stateId: 'todo',
          labelIds: [],
          subscriberIds: [],
          relatedIssueIds: [],
          blockedByIds: [],
          sortOrder: 1,
          revision: 2,
          createdAt: 1,
          updatedAt: 2,
        }),
        changedFields: ['title'],
      }),
    )
    expect(fromString?.patch).toEqual({ title: 'After drop' })
  })

  it('marks delete events without applying a patch', () => {
    const remote = toRemoteEvent(
      change({ operation: 'delete', changedFields: ['*'], payload: null }),
    )
    expect(remote?.deleted).toBe(true)
    expect(remote?.issueId).toBe('iss_1')
  })
})
