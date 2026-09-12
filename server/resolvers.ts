import { Kind, GraphQLScalarType } from 'graphql'
import type { AuthContext } from './auth.ts'
import { asNumber } from './db.ts'
import {
  commentCreate,
  issueArchive,
  issueBatchUpdate,
  issueCreate,
  issueUpdate,
  projectCreate,
  projectUpdate,
} from './domain.ts'
import { fetchWorkspaceChanges } from './live.ts'
import {
  attachManyIssueJoins,
  loadIssue,
  loadProject,
  mapComment,
  mapIssueRow,
  type IssueRecord,
} from './map.ts'

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value)
      } catch {
        return ast.value
      }
    }
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) return Number(ast.value)
    if (ast.kind === Kind.BOOLEAN) return ast.value
    if (ast.kind === Kind.NULL) return null
    return null
  },
})

type GqlContext = AuthContext

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  const value = Number(cursor)
  return Number.isFinite(value) ? value : 0
}

export const resolvers = {
  JSON: JSONScalar,
  Query: {
    viewer: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const user = await ctx.db.query(
        `SELECT id, name, email, initials FROM users WHERE id = $1`,
        [ctx.userId],
      )
      const workspace = await ctx.db.query(
        `SELECT id, name, url_key, change_sequence FROM workspaces WHERE id = $1`,
        [ctx.workspaceId],
      )
      return {
        id: ctx.userId,
        user: user.rows[0],
        workspace: workspace.rows[0]
          ? {
              id: workspace.rows[0].id,
              name: workspace.rows[0].name,
              urlKey: workspace.rows[0].url_key,
              changeSequence: asNumber(workspace.rows[0].change_sequence),
            }
          : null,
      }
    },
    teams: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const result = await ctx.db.query<{
        id: string
        workspace_id: string
        key: string
        name: string
        issue_counter: unknown
        private: boolean
        cycle_duration_weeks: number
      }>(
        `SELECT t.*
         FROM teams t
         WHERE t.workspace_id = $1
           AND (
             t.private = false
             OR EXISTS (
               SELECT 1 FROM team_memberships m
               WHERE m.team_id = t.id AND m.user_id = $2
             )
           )
         ORDER BY name`,
        [ctx.workspaceId, ctx.userId],
      )
      return result.rows.map(mapTeam)
    },
    team: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
      const result = await ctx.db.query(
        `SELECT * FROM teams WHERE id = $1 AND workspace_id = $2`,
        [args.id, ctx.workspaceId],
      )
      const row = result.rows[0]
      if (!row) return null
      if (row.private) {
        const member = await ctx.db.query(
          `SELECT 1 FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
          [args.id, ctx.userId],
        )
        if (!member.rows[0]) return null
      }
      return mapTeam(row)
    },
    issues: async (
      _: unknown,
      args: {
        filter?: {
          teamId?: string | null
          stateId?: string | null
          assigneeId?: string | null
          projectId?: string | null
          cycleId?: string | null
          query?: string | null
          includeArchived?: boolean | null
        } | null
        first?: number | null
        after?: string | null
      },
      ctx: GqlContext,
    ) => {
      const limit = Math.min(Math.max(args.first ?? 100, 1), 500)
      const offset = decodeCursor(args.after)
      const filter = args.filter ?? {}
      const result = await ctx.db.query(
        `SELECT i.*
         FROM issues i
         JOIN teams t ON t.id = i.team_id
         WHERE i.workspace_id = $1
           AND ($2::boolean OR i.archived_at IS NULL)
           AND ($3::text IS NULL OR i.team_id = $3)
           AND ($4::text IS NULL OR i.state_id = $4)
           AND ($5::text IS NULL OR i.assignee_id = $5)
           AND ($6::text IS NULL OR i.project_id = $6)
           AND ($7::text IS NULL OR i.cycle_id = $7)
           AND (
             $8::text IS NULL OR $8 = '' OR
             i.identifier ILIKE '%' || $8 || '%' OR
             i.title ILIKE '%' || $8 || '%' OR
             i.description ILIKE '%' || $8 || '%'
           )
           AND (
             t.private = false OR EXISTS (
               SELECT 1 FROM team_memberships m
               WHERE m.team_id = t.id AND m.user_id = $9
             )
           )
         ORDER BY i.updated_at DESC, i.id
         OFFSET $10 LIMIT $11`,
        [
          ctx.workspaceId,
          Boolean(filter.includeArchived),
          filter.teamId ?? null,
          filter.stateId ?? null,
          filter.assigneeId ?? null,
          filter.projectId ?? null,
          filter.cycleId ?? null,
          filter.query ?? null,
          ctx.userId,
          offset,
          limit + 1,
        ],
      )
      const rows = result.rows.slice(0, limit).map((row) => mapIssueRow(row as never))
      const nodes = await attachManyIssueJoins(ctx.db, ctx.workspaceId, rows)
      return {
        nodes,
        pageInfo: {
          hasNextPage: result.rows.length > limit,
          endCursor: result.rows.length > limit ? String(offset + limit) : null,
        },
      }
    },
    issue: async (
      _: unknown,
      args: { id?: string | null; identifier?: string | null },
      ctx: GqlContext,
    ) => {
      if (args.id) {
        const issue = await loadIssue(ctx.db, ctx.workspaceId, args.id)
        return issue && (await canSeeIssue(ctx, issue)) ? issue : null
      }
      if (args.identifier) {
        const result = await ctx.db.query(
          `SELECT * FROM issues WHERE workspace_id = $1 AND identifier = $2`,
          [ctx.workspaceId, args.identifier],
        )
        const row = result.rows[0]
        if (!row) return null
        const issue = await attachManyIssueJoins(ctx.db, ctx.workspaceId, [
          mapIssueRow(row as never),
        ])
        const found = issue[0]
        return found && (await canSeeIssue(ctx, found)) ? found : null
      }
      return null
    },
    projects: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const result = await ctx.db.query(`SELECT id FROM projects WHERE workspace_id = $1 ORDER BY name`, [
        ctx.workspaceId,
      ])
      const projects = []
      for (const row of result.rows) {
        const project = await loadProject(ctx.db, ctx.workspaceId, String(row.id))
        if (project) projects.push(project)
      }
      return projects
    },
    project: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
      return loadProject(ctx.db, ctx.workspaceId, args.id)
    },
    cycles: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const result = await ctx.db.query(
        `SELECT * FROM cycles WHERE workspace_id = $1 ORDER BY number DESC`,
        [ctx.workspaceId],
      )
      return result.rows.map(mapCycle)
    },
    initiatives: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const result = await ctx.db.query(
        `SELECT * FROM initiatives WHERE workspace_id = $1 ORDER BY name`,
        [ctx.workspaceId],
      )
      const links = await ctx.db.query<{ initiative_id: string; project_id: string }>(
        `SELECT initiative_id, project_id FROM initiative_projects WHERE workspace_id = $1`,
        [ctx.workspaceId],
      )
      const grouped = new Map<string, string[]>()
      for (const row of links.rows) {
        const list = grouped.get(row.initiative_id) ?? []
        list.push(row.project_id)
        grouped.set(row.initiative_id, list)
      }
      return result.rows.map((row) => mapInitiative(row, grouped.get(String(row.id)) ?? []))
    },
    search: async (_: unknown, args: { query: string }, ctx: GqlContext) => {
      const query = args.query.trim()
      const issuesResult = await ctx.db.query(
        `SELECT i.*
         FROM issues i
         JOIN teams t ON t.id = i.team_id
         WHERE i.workspace_id = $1
           AND i.archived_at IS NULL
           AND (
             i.identifier ILIKE '%' || $2 || '%' OR
             i.title ILIKE '%' || $2 || '%' OR
             i.description ILIKE '%' || $2 || '%'
           )
           AND (
             t.private = false OR EXISTS (
               SELECT 1 FROM team_memberships m
               WHERE m.team_id = t.id AND m.user_id = $3
             )
           )
         ORDER BY i.updated_at DESC
         LIMIT 20`,
        [ctx.workspaceId, query, ctx.userId],
      )
      const issues = await attachManyIssueJoins(
        ctx.db,
        ctx.workspaceId,
        issuesResult.rows.map((row) => mapIssueRow(row as never)),
      )
      const projectsResult = await ctx.db.query(
        `SELECT id FROM projects
         WHERE workspace_id = $1 AND (name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
         LIMIT 10`,
        [ctx.workspaceId, query],
      )
      const projects = []
      for (const row of projectsResult.rows) {
        const project = await loadProject(ctx.db, ctx.workspaceId, String(row.id))
        if (project) projects.push(project)
      }
      const documents = await ctx.db.query(
        `SELECT id, workspace_id, project_id, title, body
         FROM documents WHERE workspace_id = $1 AND (title ILIKE '%' || $2 || '%' OR body ILIKE '%' || $2 || '%')
         LIMIT 10`,
        [ctx.workspaceId, query],
      )
      return {
        issues,
        projects,
        documents: documents.rows.map((row) => ({
          id: row.id,
          workspaceId: row.workspace_id,
          projectId: row.project_id,
          title: row.title,
          body: row.body,
        })),
      }
    },
    bootstrap: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const viewer = await resolvers.Query.viewer(_, __, ctx)
      const teams = await resolvers.Query.teams(_, __, ctx)
      const users = await ctx.db.query(
        `SELECT u.id, u.name, u.email, u.initials
         FROM users u
         JOIN memberships m ON m.user_id = u.id
         WHERE m.workspace_id = $1`,
        [ctx.workspaceId],
      )
      const states = await ctx.db.query(
        `SELECT * FROM workflow_states WHERE workspace_id = $1 ORDER BY position`,
        [ctx.workspaceId],
      )
      const labels = await ctx.db.query(`SELECT * FROM labels WHERE workspace_id = $1`, [
        ctx.workspaceId,
      ])
      const projects = await resolvers.Query.projects(_, __, ctx)
      const cycles = await resolvers.Query.cycles(_, __, ctx)
      const milestones = await ctx.db.query(
        `SELECT * FROM milestones WHERE workspace_id = $1 ORDER BY sort_order`,
        [ctx.workspaceId],
      )
      const issuesPage = await resolvers.Query.issues(
        _,
        { first: 500, filter: { includeArchived: true } },
        ctx,
      )
      const comments = await ctx.db.query(`SELECT * FROM comments WHERE workspace_id = $1`, [
        ctx.workspaceId,
      ])
      const initiatives = await resolvers.Query.initiatives(_, __, ctx)
      return {
        lastSyncId: viewer.workspace?.changeSequence ?? 0,
        workspace: viewer.workspace,
        currentUser: viewer.user,
        teams,
        users: users.rows,
        states: states.rows.map(mapState),
        labels: labels.rows.map(mapLabel),
        projects,
        cycles,
        milestones: milestones.rows.map(mapMilestone),
        issues: issuesPage.nodes,
        comments: comments.rows.map((row) => mapComment(row as never)),
        initiatives,
      }
    },
    workspaceChanges: async (
      _: unknown,
      args: { after?: number | null; first?: number | null },
      ctx: GqlContext,
    ) => {
      const page = await fetchWorkspaceChanges(
        ctx.db,
        ctx.workspaceId,
        ctx.userId,
        args.after ?? 0,
        args.first ?? 200,
      )
      return {
        nodes: page.nodes,
        pageInfo: {
          hasNextPage: page.hasNextPage,
          endCursor: String(page.checkpoint),
        },
        checkpoint: page.checkpoint,
      }
    },
  },
  Mutation: {
    issueCreate: (_: unknown, args: { input: Parameters<typeof issueCreate>[1] }, ctx: GqlContext) =>
      issueCreate(ctx, args.input),
    issueUpdate: (_: unknown, args: { input: Parameters<typeof issueUpdate>[1] }, ctx: GqlContext) =>
      issueUpdate(ctx, args.input),
    issueArchive: (
      _: unknown,
      args: { input: { clientMutationId: string; id: string; expectedRevision?: number | null } },
      ctx: GqlContext,
    ) => issueArchive(ctx, args.input),
    issueBatchUpdate: (
      _: unknown,
      args: {
        input: {
          clientMutationId: string
          patches: Array<Parameters<typeof issueUpdate>[1] & { archived?: boolean | null }>
        }
      },
      ctx: GqlContext,
    ) =>
      issueBatchUpdate(ctx, {
        clientMutationId: args.input.clientMutationId,
        patches: args.input.patches.map((patch) => ({
          ...patch,
          clientMutationId: args.input.clientMutationId,
        })),
      }),
    commentCreate: (
      _: unknown,
      args: { input: Parameters<typeof commentCreate>[1] },
      ctx: GqlContext,
    ) => commentCreate(ctx, args.input),
    projectCreate: (
      _: unknown,
      args: { input: Parameters<typeof projectCreate>[1] },
      ctx: GqlContext,
    ) => projectCreate(ctx, args.input),
    projectUpdate: (
      _: unknown,
      args: { input: Parameters<typeof projectUpdate>[1] },
      ctx: GqlContext,
    ) => projectUpdate(ctx, args.input),
  },
}

async function canSeeIssue(ctx: GqlContext, issue: IssueRecord): Promise<boolean> {
  const team = await ctx.db.query<{ private: boolean }>(
    `SELECT private FROM teams WHERE id = $1`,
    [issue.teamId],
  )
  if (!team.rows[0]?.private) return true
  const member = await ctx.db.query(
    `SELECT 1 FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
    [issue.teamId, ctx.userId],
  )
  return Boolean(member.rows[0])
}

function mapTeam(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    key: row.key,
    name: row.name,
    issueCounter: asNumber(row.issue_counter),
    private: Boolean(row.private),
    cycleDurationWeeks: asNumber(row.cycle_duration_weeks, 2),
  }
}

function mapState(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    name: row.name,
    type: row.type,
    color: row.color,
    position: asNumber(row.position),
    isDefault: Boolean(row.is_default),
  }
}

function mapLabel(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    name: row.name,
    color: row.color,
  }
}

function mapCycle(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    number: asNumber(row.number),
    startsAt: asNumber(row.starts_at),
    endsAt: asNumber(row.ends_at),
    completedAt: row.completed_at == null ? null : asNumber(row.completed_at),
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  }
}

function mapMilestone(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    targetAt: row.target_at == null ? null : asNumber(row.target_at),
    sortOrder: asNumber(row.sort_order),
  }
}

function mapInitiative(row: Record<string, unknown>, projectIds: string[]) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? '',
    ownerId: row.owner_id ?? null,
    leadTeamId: row.lead_team_id ?? null,
    status: row.status,
    priority: asNumber(row.priority),
    targetAt: row.target_at == null ? null : asNumber(row.target_at),
    projectIds,
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  }
}
