import { describe, expect, it } from 'vitest'
import { IDS } from '../src/lib/seed.ts'
import {
  ISSUE_ARCHIVE,
  ISSUE_CREATE,
  ISSUE_UPDATE,
  PROJECT_CREATE,
  PROJECT_UPDATE,
  SEARCH,
  VIEWER,
  COMMENT_CREATE,
  ISSUE_BATCH_UPDATE,
} from '../src/lib/graphql/operations.ts'
import { issueCreate } from './domain.ts'
import { createSeededTestApp, graphqlRequest } from './test-utils.ts'

describe('graphql api', () => {
  it('returns viewer, teams, issues, issue, projects, project, cycles, search', async () => {
    const { yoga, ctx } = await createSeededTestApp({ demo: true })
    const viewer = await graphqlRequest<{
      viewer: { user: { id: string }; workspace: { id: string } }
    }>(yoga, VIEWER, undefined, ctx)
    expect(viewer.errors).toBeUndefined()
    expect(viewer.data?.viewer.user.id).toBe(IDS.userMe)

    const catalog = await graphqlRequest<{
      teams: Array<{ id: string }>
      issues: { nodes: Array<{ id: string; identifier: string }> }
      projects: Array<{ id: string }>
      cycles: Array<{ id: string }>
    }>(
      yoga,
      `query Catalog {
        teams { id }
        issues { nodes { id identifier } }
        projects { id }
        cycles { id }
      }`,
      undefined,
      ctx,
    )
    expect(catalog.data?.teams.some((team) => team.id === IDS.teamEng)).toBe(true)
    expect(catalog.data?.issues.nodes.length).toBeGreaterThan(0)
    const identifier = catalog.data?.issues.nodes[0]?.identifier
    const byId = await graphqlRequest<{ issue: { identifier: string } }>(
      yoga,
      `query Issue($id: ID, $identifier: String) { issue(id: $id, identifier: $identifier) { id identifier } }`,
      { id: catalog.data?.issues.nodes[0]?.id, identifier },
      ctx,
    )
    expect(byId.data?.issue.identifier).toBe(identifier)
    const project = await graphqlRequest<{ project: { id: string } }>(
      yoga,
      `query Project($id: ID!) { project(id: $id) { id } }`,
      { id: IDS.projectSync },
      ctx,
    )
    expect(project.data?.project.id).toBe(IDS.projectSync)
    const search = await graphqlRequest<{ search: { issues: Array<{ title: string }> } }>(
      yoga,
      SEARCH,
      { query: 'IndexedDB' },
      ctx,
    )
    expect(search.data?.search.issues.length).toBeGreaterThan(0)
  })

  it('creates, updates, archives, comments, and is idempotent on clientMutationId', async () => {
    const { yoga, ctx, db } = await createSeededTestApp({ demo: false })
    const created = await graphqlRequest<{
      issueCreate: {
        success: boolean
        revision: number
        issue: { id: string; identifier: string; title: string }
      }
    }>(
      yoga,
      ISSUE_CREATE,
      {
        input: {
          clientMutationId: 'm-create-1',
          teamId: IDS.teamEng,
          title: 'GraphQL created',
          stateId: IDS.stateTodo,
        },
      },
      ctx,
    )
    expect(created.data?.issueCreate.success).toBe(true)
    const issueId = created.data?.issueCreate.issue.id
    expect(issueId).toBeTruthy()
    const again = await graphqlRequest<{
      issueCreate: { issue: { id: string; title: string }; revision: number }
    }>(
      yoga,
      ISSUE_CREATE,
      {
        input: {
          clientMutationId: 'm-create-1',
          teamId: IDS.teamEng,
          title: 'GraphQL created again',
          stateId: IDS.stateTodo,
        },
      },
      ctx,
    )
    expect(again.data?.issueCreate.issue.id).toBe(issueId)
    expect(again.data?.issueCreate.issue.title).toBe('GraphQL created')

    const updated = await graphqlRequest<{
      issueUpdate: { success: boolean; revision: number; issue: { title: string } }
    }>(
      yoga,
      ISSUE_UPDATE,
      {
        input: {
          clientMutationId: 'm-update-1',
          id: issueId,
          title: 'Renamed',
          expectedRevision: created.data?.issueCreate.revision,
        },
      },
      ctx,
    )
    expect(updated.data?.issueUpdate.success).toBe(true)
    expect(updated.data?.issueUpdate.issue.title).toBe('Renamed')

    const conflict = await graphqlRequest<{
      issueUpdate: { success: boolean; error: string }
    }>(
      yoga,
      ISSUE_UPDATE,
      {
        input: {
          clientMutationId: 'm-update-conflict',
          id: issueId,
          title: 'Stale',
          expectedRevision: 1,
        },
      },
      ctx,
    )
    expect(conflict.data?.issueUpdate.success).toBe(false)
    expect(conflict.data?.issueUpdate.error).toMatch(/revision/i)

    const comment = await graphqlRequest<{
      commentCreate: { success: boolean; comment: { body: string } }
    }>(
      yoga,
      COMMENT_CREATE,
      { input: { clientMutationId: 'm-comment-1', issueId, body: 'Looks good' } },
      ctx,
    )
    expect(comment.data?.commentCreate.success).toBe(true)

    const archived = await graphqlRequest<{
      issueArchive: { success: boolean; issue: { archivedAt: number | null } }
    }>(yoga, ISSUE_ARCHIVE, { input: { clientMutationId: 'm-archive-1', id: issueId } }, ctx)
    expect(archived.data?.issueArchive.success).toBe(true)
    expect(archived.data?.issueArchive.issue.archivedAt).toBeTruthy()

    const changes = await db.query<{ n: unknown }>(
      `SELECT COUNT(*)::int AS n FROM workspace_changes WHERE workspace_id = $1`,
      [ctx.workspaceId],
    )
    expect(Number(changes.rows[0]?.n)).toBeGreaterThan(0)
    const outbox = await db.query<{ n: unknown }>(
      `SELECT COUNT(*)::int AS n FROM outbox_events WHERE workspace_id = $1`,
      [ctx.workspaceId],
    )
    expect(Number(outbox.rows[0]?.n)).toBeGreaterThan(0)
  })

  it('rejects mutations from a non-member and hides private-team issues', async () => {
    const { yoga, ctx, db } = await createSeededTestApp({ demo: false })
    await db.query(
      `INSERT INTO users (id, name, email, initials, created_at, updated_at)
       VALUES ('user_stranger','Stranger','s@acme.test','ST',$1,$1)`,
      [Date.now()],
    )
    const forbidden = await graphqlRequest<{
      issueCreate: { success: boolean; error: string }
    }>(
      yoga,
      ISSUE_CREATE,
      {
        input: {
          clientMutationId: 'm-forbidden',
          teamId: IDS.teamEng,
          title: 'Nope',
        },
      },
      { userId: 'user_stranger', workspaceId: ctx.workspaceId },
    )
    expect(forbidden.data?.issueCreate.success).toBe(false)

    const { seedPrivateTeam } = await import('./fixtures.ts')
    const privateTeam = await seedPrivateTeam(db, ctx.workspaceId, {
      memberIds: [IDS.userMaya],
    })
    const created = await issueCreate(
      { ...ctx, userId: IDS.userMaya },
      {
        clientMutationId: 'priv-1',
        teamId: privateTeam,
        title: 'Design only',
        stateId: `${privateTeam}_todo`,
      },
    )
    expect(created.success).toBe(true)
    const hidden = await graphqlRequest<{ issue: { id: string } | null }>(
      yoga,
      `query Issue($id: ID) { issue(id: $id) { id } }`,
      { id: created.issue?.id },
      ctx,
    )
    expect(hidden.data?.issue).toBeNull()
    const visible = await graphqlRequest<{ issue: { id: string } | null }>(
      yoga,
      `query Issue($id: ID) { issue(id: $id) { id } }`,
      { id: created.issue?.id },
      { userId: IDS.userMaya, workspaceId: ctx.workspaceId },
    )
    expect(visible.data?.issue?.id).toBe(created.issue?.id)
  })

  it('batch-updates issues and mutates projects', async () => {
    const { yoga, ctx } = await createSeededTestApp({ demo: false })
    const a = await issueCreate(ctx, {
      clientMutationId: 'b1',
      teamId: IDS.teamEng,
      title: 'One',
      stateId: IDS.stateTodo,
    })
    const b = await issueCreate(ctx, {
      clientMutationId: 'b2',
      teamId: IDS.teamEng,
      title: 'Two',
      stateId: IDS.stateTodo,
    })
    const batch = await graphqlRequest<{
      issueBatchUpdate: { success: boolean; issues: Array<{ title: string }> }
    }>(
      yoga,
      ISSUE_BATCH_UPDATE,
      {
        input: {
          clientMutationId: 'm-batch',
          patches: [
            { id: a.issue?.id, title: 'One*' },
            { id: b.issue?.id, title: 'Two*' },
          ],
        },
      },
      ctx,
    )
    expect(batch.data?.issueBatchUpdate.success).toBe(true)
    expect(batch.data?.issueBatchUpdate.issues.map((row) => row.title).sort()).toEqual([
      'One*',
      'Two*',
    ])

    const created = await graphqlRequest<{
      projectCreate: { success: boolean; project: { id: string } }
    }>(
      yoga,
      PROJECT_CREATE,
      {
        input: {
          clientMutationId: 'p1',
          teamId: IDS.teamEng,
          name: 'Timeline',
        },
      },
      ctx,
    )
    expect(created.data?.projectCreate.success).toBe(true)
    const updated = await graphqlRequest<{
      projectUpdate: { project: { health: string } }
    }>(
      yoga,
      PROJECT_UPDATE,
      {
        input: {
          clientMutationId: 'p2',
          id: created.data?.projectCreate.project.id,
          health: 'at-risk',
        },
      },
      ctx,
    )
    expect(updated.data?.projectUpdate.project.health).toBe('at-risk')
  })
})
