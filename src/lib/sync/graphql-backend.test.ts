import { describe, expect, it } from 'vitest'
import { createBootstrapSnapshot, IDS } from '../seed'
import { MemoryPersistence } from '../persist'
import { NockStore } from '../store'
import { GraphQLSyncBackend } from './graphql-backend'
import { createSeededTestApp } from '../../../server/test-utils.ts'
import { ISSUE_CREATE } from '../graphql/operations'

describe('GraphQLSyncBackend', () => {
  it('persists optimistic creates to postgres without a spinner', async () => {
    const { yoga, ctx, db } = await createSeededTestApp({ demo: false })
    const backend = new GraphQLSyncBackend({
      url: 'http://nock.test/graphql',
      fetch: (input, init) => yoga.fetch(String(input), init),
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    })
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }), new MemoryPersistence(), {
      backend,
    })
    const issue = store.createIssue({ title: 'From the client', stateId: IDS.stateTodo })
    expect(store.issue(issue.id)?.title).toBe('From the client')
    expect(store.sync.showsSpinner).toBe(false)
    await store.flushSync()
    expect(store.sync.statusForIssue(issue.id)).toBeNull()
    expect(store.issue(issue.id)!.revision).toBeGreaterThan(0)
    const row = await db.query<{ title: string; revision: unknown }>(
      `SELECT title, revision FROM issues WHERE id = $1`,
      [issue.id],
    )
    expect(row.rows[0]?.title).toBe('From the client')
    expect(Number(row.rows[0]?.revision)).toBeGreaterThan(0)

    store.updateIssue(issue.id, { title: 'Still instant' })
    expect(store.issue(issue.id)?.title).toBe('Still instant')
    await store.flushSync()
    const updated = await db.query<{ title: string }>(`SELECT title FROM issues WHERE id = $1`, [
      issue.id,
    ])
    expect(updated.rows[0]?.title).toBe('Still instant')
  })

  it('retries with the same clientMutationId only apply once', async () => {
    const { yoga, ctx, db } = await createSeededTestApp({ demo: false })
    const backend = new GraphQLSyncBackend({
      url: 'http://nock.test/graphql',
      fetch: (input, init) => yoga.fetch(String(input), init),
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    })
    const first = await backend.request<{
      issueCreate: { issue: { id: string }; revision: number }
    }>(ISSUE_CREATE, {
      input: {
        clientMutationId: 'dup-1',
        teamId: IDS.teamEng,
        title: 'Once',
        stateId: IDS.stateTodo,
      },
    })
    const second = await backend.request<{
      issueCreate: { issue: { id: string }; revision: number }
    }>(ISSUE_CREATE, {
      input: {
        clientMutationId: 'dup-1',
        teamId: IDS.teamEng,
        title: 'Twice',
        stateId: IDS.stateTodo,
      },
    })
    expect(first.data?.issueCreate.issue.id).toBe(second.data?.issueCreate.issue.id)
    const count = await db.query<{ n: unknown }>(
      `SELECT COUNT(*)::int AS n FROM issues WHERE workspace_id = $1 AND title = 'Once'`,
      [ctx.workspaceId],
    )
    expect(Number(count.rows[0]?.n)).toBe(1)
  })
})
