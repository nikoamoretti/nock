import { describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createBootstrapSnapshot, IDS } from '../src/lib/seed.ts'
import { MemoryPersistence } from '../src/lib/persist.ts'
import { NockStore } from '../src/lib/store.ts'
import { GraphQLSyncBackend } from '../src/lib/sync/graphql-backend.ts'
import { RealtimeClient, type WorkspaceChange } from '../src/lib/sync/realtime.ts'
import { issueCreate, issueUpdate } from './domain.ts'
import { startApiServer } from './index.ts'
import { fetchWorkspaceChanges, LiveHub, userCanSeeTeam } from './live.ts'
import { createSeededTestApp, seedPrivateTeam } from './test-utils.ts'

function storeFor(userId: string) {
  const snapshot = createBootstrapSnapshot({ demo: false })
  snapshot.currentUserId = userId
  return NockStore.from(snapshot, new MemoryPersistence())
}

function titleFromRaw(raw: Buffer | string): string | null {
  const parsed = JSON.parse(String(raw)) as { change?: { payload?: unknown } }
  let payload = parsed.change?.payload
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return null
    }
  }
  if (payload && typeof payload === 'object' && payload !== null && 'title' in payload) {
    const title = (payload as { title?: unknown }).title
    return typeof title === 'string' ? title : null
  }
  return null
}

function waitForOpen(socket: WebSocket, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} open timeout`)), 5000)
    socket.on('open', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function attachRealtime(
  store: NockStore,
  app: Awaited<ReturnType<typeof createSeededTestApp>>,
  userId: string,
) {
  return new RealtimeClient(store, {
    pageSize: 250,
    fetchDelta: async (after, first) =>
      fetchWorkspaceChanges(app.db, app.ctx.workspaceId, userId, after, first ?? 250),
    connect: async (push) =>
      app.hub.subscribe({
        userId,
        workspaceId: app.ctx.workspaceId,
        send: (message) => {
          if (message.type === 'change') {
            push({ type: 'change', change: message.change as WorkspaceChange })
          } else {
            push(message)
          }
        },
      }),
  })
}

describe('realtime workspace changes', () => {
  it('delivers public-team changes to two users and hides private-team payloads', async () => {
    const app = await createSeededTestApp({ demo: false })
    await seedPrivateTeam(app.db, app.ctx.workspaceId, { memberIds: [IDS.userMaya] })
    const storeA = storeFor(IDS.userMe)
    const storeB = storeFor(IDS.userMaya)
    const liveA = attachRealtime(storeA, app, IDS.userMe)
    const liveB = attachRealtime(storeB, app, IDS.userMaya)
    await liveA.connect()
    await liveB.connect()

    const created = await issueCreate(app.ctx, {
      clientMutationId: 'pub-1',
      teamId: IDS.teamEng,
      title: 'Shared bug',
      stateId: IDS.stateTodo,
    })
    expect(created.success).toBe(true)
    expect(storeA.issue(created.issue!.id)?.title).toBe('Shared bug')
    expect(storeB.issue(created.issue!.id)?.title).toBe('Shared bug')

    const privateTeam = 'team_design'
    const secret = await issueCreate(
      { ...app.ctx, userId: IDS.userMaya },
      {
        clientMutationId: 'priv-1',
        teamId: privateTeam,
        title: 'Design secret',
        stateId: `${privateTeam}_todo`,
      },
    )
    expect(secret.success).toBe(true)
    expect(storeB.issue(secret.issue!.id)?.title).toBe('Design secret')
    expect(storeA.issue(secret.issue!.id)).toBeUndefined()
    expect(await userCanSeeTeam(app.db, app.ctx.workspaceId, IDS.userMe, privateTeam)).toBe(
      false,
    )
  })

  it('reconnects from checkpoint after a drop and keeps cached issues', async () => {
    const app = await createSeededTestApp({ demo: false })
    const store = storeFor(IDS.userMe)
    const live = attachRealtime(store, app, IDS.userMe)
    await live.connect()
    const first = await issueCreate(app.ctx, {
      clientMutationId: 'drop-1',
      teamId: IDS.teamEng,
      title: 'Before drop',
      stateId: IDS.stateTodo,
    })
    const cached = store.issues.size
    live.disconnect()
    store.sync.connection = 'reconnecting'
    expect(store.issue(first.issue!.id)?.title).toBe('Before drop')
    expect(store.issues.size).toBe(cached)

    await issueCreate(app.ctx, {
      clientMutationId: 'drop-2',
      teamId: IDS.teamEng,
      title: 'While disconnected',
      stateId: IDS.stateTodo,
    })
    await live.connect()
    expect(store.issues.size).toBeGreaterThanOrEqual(cached)
    expect([...store.issues.values()].some((issue) => issue.title === 'While disconnected')).toBe(
      true,
    )
    expect(store.sync.connection).toBe('live')
  })

  it('ignores repeated packets and catch-up fills an out-of-order skip', async () => {
    const app = await createSeededTestApp({ demo: false })
    const store = storeFor(IDS.userMe)
    const live = attachRealtime(store, app, IDS.userMe)
    await live.connect()
    const one = await issueCreate(app.ctx, {
      clientMutationId: 'ord-1',
      teamId: IDS.teamEng,
      title: 'First',
      stateId: IDS.stateTodo,
    })
    const two = await issueCreate(app.ctx, {
      clientMutationId: 'ord-2',
      teamId: IDS.teamEng,
      title: 'Second',
      stateId: IDS.stateTodo,
    })
    const page = await fetchWorkspaceChanges(
      app.db,
      app.ctx.workspaceId,
      IDS.userMe,
      0,
      20,
    )
    const twoChange = page.nodes.find((row) => row.entityId === two.issue!.id)!
    expect(live.applyChange(twoChange as WorkspaceChange)).toBe('duplicate')

    const three = await issueCreate(app.ctx, {
      clientMutationId: 'ord-3',
      teamId: IDS.teamEng,
      title: 'Third',
      stateId: IDS.stateTodo,
    })
    store.lastSyncId = one.lastSyncId!
    const skipped = page.nodes.find((row) => row.entityId === two.issue!.id)!
    expect(skipped.sequence).toBeGreaterThan(store.lastSyncId)
    const threeChange = (
      await fetchWorkspaceChanges(app.db, app.ctx.workspaceId, IDS.userMe, 0, 20)
    ).nodes.find((row) => row.entityId === three.issue!.id)!
    expect(live.applyChange(threeChange as WorkspaceChange)).toBe('gap')
    await live.catchUp()
    expect(store.issue(two.issue!.id)?.title).toBe('Second')
    expect(store.issue(three.issue!.id)?.title).toBe('Third')
    expect(store.lastSyncId).toBeGreaterThanOrEqual(three.lastSyncId!)
  })

  it('keeps a locally pending title while catch-up applies a remote description', async () => {
    const app = await createSeededTestApp({ demo: false })
    const store = storeFor(IDS.userMe)
    const live = attachRealtime(store, app, IDS.userMe)
    await live.connect()
    const created = await issueCreate(app.ctx, {
      clientMutationId: 'pend-1',
      teamId: IDS.teamEng,
      title: 'Local title',
      description: 'old',
      stateId: IDS.stateTodo,
    })
    const id = created.issue!.id
    store.sync.online = false
    store.updateIssue(id, { title: 'Still local' })
    expect(store.sync.statusForIssue(id)).toBe('queued')
    await issueUpdate(app.ctx, {
      clientMutationId: 'pend-desc',
      id,
      description: 'from server',
    })
    await live.catchUp()
    expect(store.issue(id)?.title).toBe('Still local')
    expect(store.issue(id)?.description).toBe('from server')
  })

  it('drops private-team issues when permission is revoked while connected', async () => {
    const app = await createSeededTestApp({ demo: false })
    const privateTeam = await seedPrivateTeam(app.db, app.ctx.workspaceId, {
      memberIds: [IDS.userMe, IDS.userMaya],
    })
    const store = storeFor(IDS.userMe)
    const live = attachRealtime(store, app, IDS.userMe)
    await live.connect()
    const secret = await issueCreate(app.ctx, {
      clientMutationId: 'rev-1',
      teamId: privateTeam,
      title: 'Soon hidden',
      stateId: `${privateTeam}_todo`,
    })
    expect(store.issue(secret.issue!.id)).toBeTruthy()
    await app.db.query(`DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2`, [
      privateTeam,
      IDS.userMe,
    ])
    app.hub.revoke(app.ctx.workspaceId, IDS.userMe, privateTeam)
    expect(store.issue(secret.issue!.id)).toBeUndefined()
    const later = await issueCreate(
      { ...app.ctx, userId: IDS.userMaya },
      {
        clientMutationId: 'rev-2',
        teamId: privateTeam,
        title: 'After revoke',
        stateId: `${privateTeam}_todo`,
      },
    )
    expect(later.success).toBe(true)
    expect(store.issue(later.issue!.id)).toBeUndefined()
  })

  it('catches up 10,000 changes in sequence', async () => {
    const app = await createSeededTestApp({ demo: false })
    const created = await issueCreate(app.ctx, {
      clientMutationId: 'bulk-seed',
      teamId: IDS.teamEng,
      title: 'Anchor',
      stateId: IDS.stateTodo,
    })
    const issueId = created.issue!.id
    const start = created.lastSyncId ?? 0
    await app.db.query(
      `INSERT INTO workspace_changes (
         workspace_id, sequence, entity_type, entity_id, operation, revision,
         changed_fields, payload, sync_group, authorization_team_id, actor_id,
         client_mutation_id, created_at
       )
       SELECT $1::text, ($2::bigint) + g, 'issue', $3::text, 'update', 1 + g,
              ARRAY['title']::text[],
              json_build_object(
                'id', $3::text, 'teamId', $4::text, 'title', 'bulk-' || g, 'description', '',
                'priority', 0, 'stateId', $5::text, 'number', 1, 'identifier', 'ENG-1',
                'labelIds', json_build_array(), 'subscriberIds', json_build_array(),
                'relatedIssueIds', json_build_array(), 'blockedByIds', json_build_array(),
                'sortOrder', 1, 'revision', 1 + g, 'createdAt', $6::bigint, 'updatedAt', $6::bigint
              ),
              'team:team_eng', $4::text, $7::text, 'bulk-' || g, $6::bigint
       FROM generate_series(1, 10000) AS g`,
      [
        app.ctx.workspaceId,
        start,
        issueId,
        IDS.teamEng,
        IDS.stateTodo,
        Date.now(),
        IDS.userMe,
      ],
    )
    await app.db.query(`UPDATE workspaces SET change_sequence = $2 WHERE id = $1`, [
      app.ctx.workspaceId,
      start + 10000,
    ])
    const store = storeFor(IDS.userMe)
    store.lastSyncId = start
    const live = attachRealtime(store, app, IDS.userMe)
    await live.catchUp()
    expect(store.lastSyncId).toBe(start + 10000)
    expect(store.issue(issueId)?.title).toBe('bulk-10000')
  }, 30_000)

  it('replays missed events over a real websocket after a drop', async () => {
    const hub = new LiveHub()
    const started = await startApiServer({
      port: 0,
      ephemeral: true,
      seedDemo: false,
      hub,
    })
    const received: string[] = []
    const first = new WebSocket(
      `${started.wsUrl}?userId=${IDS.userMe}&workspaceId=${IDS.workspace}&checkpoint=0`,
    )
    first.on('message', (raw: Buffer | string) => {
      const title = titleFromRaw(raw)
      if (title) received.push(title)
    })
    await waitForOpen(first, 'first socket')
    const backend = new GraphQLSyncBackend({
      url: started.url,
      userId: IDS.userMe,
      workspaceId: IDS.workspace,
    })
    const created = await backend.request<{
      issueCreate: { success: boolean; error?: string | null; issue?: { title: string } }
    }>(
      `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success error issue { title } } }`,
      {
        input: {
          clientMutationId: 'ws-1',
          teamId: IDS.teamEng,
          title: 'Live one',
          stateId: IDS.stateTodo,
        },
      },
    )
    expect(created.data?.issueCreate.success).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 80))
    first.close()
    const secondCreate = await backend.request<{
      issueCreate: { success: boolean; error?: string | null }
    }>(
      `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success error issue { title } } }`,
      {
        input: {
          clientMutationId: 'ws-2',
          teamId: IDS.teamEng,
          title: 'After drop',
          stateId: IDS.stateTodo,
        },
      },
    )
    expect(secondCreate.data?.issueCreate.success).toBe(true)
    const replayed: string[] = []
    const second = new WebSocket(
      `${started.wsUrl}?userId=${IDS.userMe}&workspaceId=${IDS.workspace}&checkpoint=0`,
    )
    const sawAfterDrop = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`replay titles: ${replayed.join(',')}`)),
        3000,
      )
      second.on('message', (raw: Buffer | string) => {
        const title = titleFromRaw(raw)
        if (title) replayed.push(title)
        if (replayed.includes('After drop')) {
          clearTimeout(timer)
          resolve()
        }
      })
    })
    await waitForOpen(second, 'second socket')
    await sawAfterDrop
    expect(replayed).toContain('After drop')
    expect(received).toContain('Live one')
    second.close()
    await started.close()
  }, 15_000)
})
