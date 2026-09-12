import { assertTeamAccess, assertWorkspaceMember, DomainError, newId, type AuthContext } from './auth.ts'
import { asNumber, jsonParam, type Database } from './db.ts'
import { publishSequence } from './live.ts'
import {
  loadIssue,
  loadProject,
  mapComment,
  type CommentRecord,
  type IssueRecord,
  type ProjectRecord,
} from './map.ts'

export type IssueCreateInput = {
  clientMutationId: string
  id?: string | null
  teamId: string
  title: string
  description?: string | null
  priority?: number | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueAt?: number | null
  sortOrder?: number | null
  number?: number | null
  identifier?: string | null
  labelIds?: string[] | null
  subscriberIds?: string[] | null
}

export type IssueUpdateInput = {
  clientMutationId: string
  id: string
  expectedRevision?: number | null
  title?: string | null
  description?: string | null
  priority?: number | null
  stateId?: string | null
  assigneeId?: string | null
  projectId?: string | null
  cycleId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueAt?: number | null
  sortOrder?: number | null
  teamId?: string | null
  labelIds?: string[] | null
  subscriberIds?: string[] | null
  relatedIssueIds?: string[] | null
  blockedByIds?: string[] | null
  duplicateOfId?: string | null
  archived?: boolean | null
}

type ReceiptRow = { payload: unknown; revision: unknown }

async function finish<T extends { success: boolean; lastSyncId: number | null }>(
  ctx: AuthContext,
  result: T,
): Promise<T> {
  if (result.success) await publishSequence(ctx, result.lastSyncId)
  return result
}

async function readReceipt<T>(
  db: Database,
  workspaceId: string,
  clientMutationId: string,
): Promise<T | null> {
  const result = await db.query<ReceiptRow>(
    `SELECT payload, revision FROM mutation_receipts
     WHERE workspace_id = $1 AND client_mutation_id = $2`,
    [workspaceId, clientMutationId],
  )
  const row = result.rows[0]
  if (!row) return null
  return (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as T
}

async function writeChange(
  db: Database,
  ctx: AuthContext,
  input: {
    entityType: string
    entityId: string
    operation: 'insert' | 'update' | 'archive' | 'delete'
    revision: number
    changedFields: string[]
    payload: unknown
    teamId: string | null
    clientMutationId: string
  },
): Promise<number> {
  const now = Date.now()
  const seq = await db.query<{ change_sequence: unknown }>(
    `UPDATE workspaces SET change_sequence = change_sequence + 1, updated_at = $2
     WHERE id = $1 RETURNING change_sequence`,
    [ctx.workspaceId, now],
  )
  const sequence = asNumber(seq.rows[0]?.change_sequence)
  await db.query(
    `INSERT INTO workspace_changes (
       workspace_id, sequence, entity_type, entity_id, operation, revision,
       changed_fields, payload, sync_group, authorization_team_id, actor_id,
       client_mutation_id, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
    [
      ctx.workspaceId,
      sequence,
      input.entityType,
      input.entityId,
      input.operation,
      input.revision,
      input.changedFields,
      jsonParam(input.payload),
      input.teamId ? `team:${input.teamId}` : 'workspace',
      input.teamId,
      ctx.userId,
      input.clientMutationId,
      now,
    ],
  )
  await db.query(
    `INSERT INTO outbox_events (id, workspace_id, topic, payload, created_at)
     VALUES ($1,$2,$3,$4::jsonb,$5)`,
    [
      newId('outbox'),
      ctx.workspaceId,
      `${input.entityType}.${input.operation}`,
      jsonParam({
        sequence,
        entityType: input.entityType,
        entityId: input.entityId,
        clientMutationId: input.clientMutationId,
      }),
      now,
    ],
  )
  return sequence
}

async function writeReceipt(
  db: Database,
  ctx: AuthContext,
  clientMutationId: string,
  entityType: string,
  entityId: string,
  revision: number,
  payload: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO mutation_receipts (
       workspace_id, client_mutation_id, revision, entity_type, entity_id, payload, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
     ON CONFLICT (workspace_id, client_mutation_id) DO NOTHING`,
    [
      ctx.workspaceId,
      clientMutationId,
      revision,
      entityType,
      entityId,
      jsonParam(payload),
      Date.now(),
    ],
  )
}

export type IssuePayload = {
  success: boolean
  clientMutationId: string
  issue: IssueRecord | null
  lastSyncId: number | null
  revision: number | null
  error: string | null
}

function fail(clientMutationId: string, error: string): IssuePayload {
  return {
    success: false,
    clientMutationId,
    issue: null,
    lastSyncId: null,
    revision: null,
    error,
  }
}

async function defaultStateId(db: Database, teamId: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM workflow_states WHERE team_id = $1 ORDER BY is_default DESC, position ASC LIMIT 1`,
    [teamId],
  )
  const id = result.rows[0]?.id
  if (!id) throw new DomainError('team has no workflow states', 'INVALID')
  return id
}

async function teamKey(db: Database, teamId: string): Promise<{ key: string; issue_counter: number }> {
  const result = await db.query<{ key: string; issue_counter: unknown }>(
    `SELECT key, issue_counter FROM teams WHERE id = $1 FOR UPDATE`,
    [teamId],
  )
  const row = result.rows[0]
  if (!row) throw new DomainError('team not found', 'NOT_FOUND')
  return { key: row.key, issue_counter: asNumber(row.issue_counter) }
}

async function replaceLabels(
  db: Database,
  workspaceId: string,
  issueId: string,
  labelIds: string[],
): Promise<void> {
  await db.query(`DELETE FROM issue_labels WHERE issue_id = $1`, [issueId])
  for (const labelId of [...new Set(labelIds)]) {
    await db.query(
      `INSERT INTO issue_labels (workspace_id, issue_id, label_id) VALUES ($1,$2,$3)`,
      [workspaceId, issueId, labelId],
    )
  }
}

async function replaceSubscribers(
  db: Database,
  workspaceId: string,
  issueId: string,
  userIds: string[],
): Promise<void> {
  await db.query(`DELETE FROM issue_subscribers WHERE issue_id = $1`, [issueId])
  for (const userId of [...new Set(userIds)]) {
    await db.query(
      `INSERT INTO issue_subscribers (workspace_id, issue_id, user_id) VALUES ($1,$2,$3)`,
      [workspaceId, issueId, userId],
    )
  }
}

async function replaceRelations(
  db: Database,
  workspaceId: string,
  issueId: string,
  kind: 'related' | 'blocks' | 'duplicate',
  relatedIds: string[],
): Promise<void> {
  await db.query(`DELETE FROM issue_relations WHERE issue_id = $1 AND kind = $2`, [issueId, kind])
  for (const relatedId of [...new Set(relatedIds)]) {
    if (relatedId === issueId) continue
    await db.query(
      `INSERT INTO issue_relations (workspace_id, issue_id, related_issue_id, kind)
       VALUES ($1,$2,$3,$4)`,
      [workspaceId, issueId, relatedId, kind],
    )
  }
}

export async function issueCreate(
  ctx: AuthContext,
  input: IssueCreateInput,
): Promise<IssuePayload> {
  try {
    await assertWorkspaceMember(ctx)
    const existing = await readReceipt<IssuePayload>(
      ctx.db,
      ctx.workspaceId,
      input.clientMutationId,
    )
    if (existing) return existing
    await assertTeamAccess(ctx, input.teamId)
    const title = input.title.trim()
    if (!title) return fail(input.clientMutationId, 'title is required')

    const payload = await ctx.db.transaction(async (db) => {
      const inner = { ...ctx, db }
      const replay = await readReceipt<IssuePayload>(
        db,
        ctx.workspaceId,
        input.clientMutationId,
      )
      if (replay) return replay
      const team = await teamKey(db, input.teamId)
      const stateId = input.stateId ?? (await defaultStateId(db, input.teamId))
      const id = input.id?.trim() || newId('issue')
      let number = input.number && input.number > 0 ? Math.floor(input.number) : team.issue_counter + 1
      if (number <= team.issue_counter && !input.number) number = team.issue_counter + 1
      const taken = await db.query(
        `SELECT 1 FROM issues WHERE team_id = $1 AND number = $2`,
        [input.teamId, number],
      )
      if (taken.rows[0]) {
        number = team.issue_counter + 1
      }
      const identifier = input.identifier?.trim() || `${team.key}-${number}`
      const now = Date.now()
      const nextCounter = Math.max(team.issue_counter, number)
      await db.query(`UPDATE teams SET issue_counter = $2, updated_at = $3 WHERE id = $1`, [
        input.teamId,
        nextCounter,
        now,
      ])
      await db.query(
        `INSERT INTO issues (
           id, workspace_id, team_id, number, identifier, title, description, priority,
           state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
           sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,NULL,$17,$17,$18)`,
        [
          id,
          ctx.workspaceId,
          input.teamId,
          number,
          identifier,
          title,
          input.description ?? '',
          input.priority ?? 0,
          stateId,
          input.assigneeId ?? null,
          input.projectId ?? null,
          input.cycleId ?? null,
          input.milestoneId ?? null,
          input.parentId ?? null,
          input.dueAt ?? null,
          input.sortOrder ?? number,
          now,
          input.clientMutationId,
        ],
      )
      await replaceLabels(db, ctx.workspaceId, id, input.labelIds ?? [])
      await replaceSubscribers(
        db,
        ctx.workspaceId,
        id,
        input.subscriberIds?.length ? input.subscriberIds : [ctx.userId],
      )
      const issue = await loadIssue(db, ctx.workspaceId, id)
      if (!issue) throw new DomainError('failed to load created issue')
      const sequence = await writeChange(db, inner, {
        entityType: 'issue',
        entityId: id,
        operation: 'insert',
        revision: issue.revision,
        changedFields: ['*'],
        payload: issue,
        teamId: issue.teamId,
        clientMutationId: input.clientMutationId,
      })
      const result: IssuePayload = {
        success: true,
        clientMutationId: input.clientMutationId,
        issue,
        lastSyncId: sequence,
        revision: issue.revision,
        error: null,
      }
      await writeReceipt(db, inner, input.clientMutationId, 'issue', id, issue.revision, result)
      return result
    })
    return finish(ctx, payload)
  } catch (error) {
    return fail(input.clientMutationId, error instanceof Error ? error.message : String(error))
  }
}

export async function issueUpdate(
  ctx: AuthContext,
  input: IssueUpdateInput,
): Promise<IssuePayload> {
  try {
    await assertWorkspaceMember(ctx)
    const existing = await readReceipt<IssuePayload>(
      ctx.db,
      ctx.workspaceId,
      input.clientMutationId,
    )
    if (existing) return existing

    const payload = await ctx.db.transaction(async (db) => {
      const inner = { ...ctx, db }
      const replay = await readReceipt<IssuePayload>(
        db,
        ctx.workspaceId,
        input.clientMutationId,
      )
      if (replay) return replay
      const current = await loadIssue(db, ctx.workspaceId, input.id)
      if (!current) return fail(input.clientMutationId, 'issue not found')
      await assertTeamAccess(inner, current.teamId)
      if (
        input.expectedRevision != null &&
        Number(input.expectedRevision) !== current.revision
      ) {
        return fail(input.clientMutationId, 'revision conflict')
      }
      const nextTeamId = input.teamId ?? current.teamId
      if (nextTeamId !== current.teamId) await assertTeamAccess(inner, nextTeamId)
      const changed: string[] = []
      const next = { ...current }
      const assign = <K extends keyof IssueRecord>(key: K, value: IssueRecord[K] | undefined) => {
        if (value === undefined) return
        if (JSON.stringify(next[key]) !== JSON.stringify(value)) {
          next[key] = value
          changed.push(key)
        }
      }
      assign('title', input.title == null ? undefined : input.title)
      assign('description', input.description == null ? undefined : input.description)
      assign('priority', input.priority == null ? undefined : input.priority)
      assign('stateId', input.stateId == null ? undefined : input.stateId)
      assign('assigneeId', input.assigneeId === undefined ? undefined : input.assigneeId)
      assign('projectId', input.projectId === undefined ? undefined : input.projectId)
      assign('cycleId', input.cycleId === undefined ? undefined : input.cycleId)
      assign('milestoneId', input.milestoneId === undefined ? undefined : input.milestoneId)
      assign('parentId', input.parentId === undefined ? undefined : input.parentId)
      assign('dueAt', input.dueAt === undefined ? undefined : input.dueAt)
      assign('sortOrder', input.sortOrder == null ? undefined : input.sortOrder)
      if (input.labelIds) assign('labelIds', input.labelIds)
      if (input.subscriberIds) assign('subscriberIds', input.subscriberIds)
      if (input.relatedIssueIds) assign('relatedIssueIds', input.relatedIssueIds)
      if (input.blockedByIds) assign('blockedByIds', input.blockedByIds)
      if (input.duplicateOfId !== undefined) assign('duplicateOfId', input.duplicateOfId)
      if (input.archived === true) {
        next.archivedAt = Date.now()
        changed.push('archivedAt')
      }
      if (nextTeamId !== current.teamId) {
        const team = await teamKey(db, nextTeamId)
        const number = team.issue_counter + 1
        next.teamId = nextTeamId
        next.number = number
        next.identifier = `${team.key}-${number}`
        changed.push('teamId', 'number', 'identifier')
        await db.query(`UPDATE teams SET issue_counter = $2, updated_at = $3 WHERE id = $1`, [
          nextTeamId,
          number,
          Date.now(),
        ])
      }
      if (changed.length === 0) {
        const result: IssuePayload = {
          success: true,
          clientMutationId: input.clientMutationId,
          issue: current,
          lastSyncId: asNumber(
            (
              await db.query<{ change_sequence: unknown }>(
                `SELECT change_sequence FROM workspaces WHERE id = $1`,
                [ctx.workspaceId],
              )
            ).rows[0]?.change_sequence,
          ),
          revision: current.revision,
          error: null,
        }
        await writeReceipt(db, inner, input.clientMutationId, 'issue', current.id, current.revision, result)
        return result
      }
      const now = Date.now()
      const revision = current.revision + 1
      await db.query(
        `UPDATE issues SET
           team_id = $2, number = $3, identifier = $4, title = $5, description = $6,
           priority = $7, state_id = $8, assignee_id = $9, project_id = $10, cycle_id = $11,
           milestone_id = $12, parent_id = $13, due_at = $14, sort_order = $15, revision = $16,
           archived_at = $17, updated_at = $18, last_mutation_id = $19
         WHERE id = $1`,
        [
          current.id,
          next.teamId,
          next.number,
          next.identifier,
          next.title,
          next.description,
          next.priority,
          next.stateId,
          next.assigneeId,
          next.projectId,
          next.cycleId,
          next.milestoneId,
          next.parentId,
          next.dueAt,
          next.sortOrder,
          revision,
          next.archivedAt,
          now,
          input.clientMutationId,
        ],
      )
      if (input.labelIds) await replaceLabels(db, ctx.workspaceId, current.id, input.labelIds)
      if (input.subscriberIds) {
        await replaceSubscribers(db, ctx.workspaceId, current.id, input.subscriberIds)
      }
      if (input.relatedIssueIds) {
        await replaceRelations(db, ctx.workspaceId, current.id, 'related', input.relatedIssueIds)
      }
      if (input.blockedByIds) {
        await replaceRelations(db, ctx.workspaceId, current.id, 'blocks', input.blockedByIds)
      }
      if (input.duplicateOfId !== undefined) {
        await replaceRelations(
          db,
          ctx.workspaceId,
          current.id,
          'duplicate',
          input.duplicateOfId ? [input.duplicateOfId] : [],
        )
      }
      const issue = await loadIssue(db, ctx.workspaceId, current.id)
      if (!issue) throw new DomainError('failed to load updated issue')
      const sequence = await writeChange(db, inner, {
        entityType: 'issue',
        entityId: issue.id,
        operation: next.archivedAt && !current.archivedAt ? 'archive' : 'update',
        revision,
        changedFields: changed,
        payload: issue,
        teamId: issue.teamId,
        clientMutationId: input.clientMutationId,
      })
      const result: IssuePayload = {
        success: true,
        clientMutationId: input.clientMutationId,
        issue,
        lastSyncId: sequence,
        revision,
        error: null,
      }
      await writeReceipt(db, inner, input.clientMutationId, 'issue', issue.id, revision, result)
      return result
    })
    return finish(ctx, payload)
  } catch (error) {
    return fail(input.clientMutationId, error instanceof Error ? error.message : String(error))
  }
}

export async function issueArchive(
  ctx: AuthContext,
  input: { clientMutationId: string; id: string; expectedRevision?: number | null },
): Promise<IssuePayload> {
  return issueUpdate(ctx, {
    clientMutationId: input.clientMutationId,
    id: input.id,
    expectedRevision: input.expectedRevision,
    archived: true,
  })
}

export async function issueBatchUpdate(
  ctx: AuthContext,
  input: { clientMutationId: string; patches: IssueUpdateInput[] },
): Promise<{
  success: boolean
  clientMutationId: string
  issues: IssueRecord[]
  lastSyncId: number | null
  error: string | null
}> {
  const existing = await readReceipt<{
    success: boolean
    clientMutationId: string
    issues: IssueRecord[]
    lastSyncId: number | null
    error: string | null
  }>(ctx.db, ctx.workspaceId, input.clientMutationId)
  if (existing) return existing
  const issues: IssueRecord[] = []
  let lastSyncId: number | null = null
  for (const [index, patch] of input.patches.entries()) {
    const result = await issueUpdate(ctx, {
      ...patch,
      clientMutationId: `${input.clientMutationId}:${index}`,
    })
    if (!result.success || !result.issue) {
      return {
        success: false,
        clientMutationId: input.clientMutationId,
        issues,
        lastSyncId,
        error: result.error,
      }
    }
    issues.push(result.issue)
    lastSyncId = result.lastSyncId
  }
  const payload = {
    success: true,
    clientMutationId: input.clientMutationId,
    issues,
    lastSyncId,
    error: null as string | null,
  }
  await writeReceipt(
    ctx.db,
    ctx,
    input.clientMutationId,
    'issue_batch',
    issues[0]?.id ?? input.clientMutationId,
    lastSyncId ?? 0,
    payload,
  )
  return finish(ctx, payload)
}

export type CommentPayload = {
  success: boolean
  clientMutationId: string
  comment: CommentRecord | null
  lastSyncId: number | null
  error: string | null
}

export async function commentCreate(
  ctx: AuthContext,
  input: { clientMutationId: string; id?: string | null; issueId: string; body: string },
): Promise<CommentPayload> {
  try {
    await assertWorkspaceMember(ctx)
    const existing = await readReceipt<CommentPayload>(
      ctx.db,
      ctx.workspaceId,
      input.clientMutationId,
    )
    if (existing) return existing
    const body = input.body.trim()
    if (!body) {
      return {
        success: false,
        clientMutationId: input.clientMutationId,
        comment: null,
        lastSyncId: null,
        error: 'comment is required',
      }
    }
    return finish(ctx, await ctx.db.transaction(async (db) => {
      const inner = { ...ctx, db }
      const issue = await loadIssue(db, ctx.workspaceId, input.issueId)
      if (!issue) {
        return {
          success: false,
          clientMutationId: input.clientMutationId,
          comment: null,
          lastSyncId: null,
          error: 'issue not found',
        }
      }
      await assertTeamAccess(inner, issue.teamId)
      const id = input.id?.trim() || newId('comment')
      const now = Date.now()
      await db.query(
        `INSERT INTO comments (id, workspace_id, issue_id, author_id, body, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [id, ctx.workspaceId, input.issueId, ctx.userId, body, now],
      )
      await db.query(
        `INSERT INTO activity_events (id, workspace_id, issue_id, actor_id, kind, body, payload, created_at)
         VALUES ($1,$2,$3,$4,'comment',$5,'{}'::jsonb,$6)`,
        [newId('activity'), ctx.workspaceId, input.issueId, ctx.userId, `Commented: ${body}`, now],
      )
      const loaded = await db.query<{
        id: string
        workspace_id: string
        issue_id: string
        author_id: string
        body: string
        created_at: unknown
        updated_at: unknown
      }>(`SELECT * FROM comments WHERE id = $1`, [id])
      const comment = mapComment(loaded.rows[0])
      const sequence = await writeChange(db, inner, {
        entityType: 'comment',
        entityId: id,
        operation: 'insert',
        revision: 1,
        changedFields: ['*'],
        payload: comment,
        teamId: issue.teamId,
        clientMutationId: input.clientMutationId,
      })
      const result: CommentPayload = {
        success: true,
        clientMutationId: input.clientMutationId,
        comment,
        lastSyncId: sequence,
        error: null,
      }
      await writeReceipt(db, inner, input.clientMutationId, 'comment', id, 1, result)
      return result
    }))
  } catch (error) {
    return {
      success: false,
      clientMutationId: input.clientMutationId,
      comment: null,
      lastSyncId: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export type ProjectPayload = {
  success: boolean
  clientMutationId: string
  project: ProjectRecord | null
  lastSyncId: number | null
  error: string | null
}

export async function projectCreate(
  ctx: AuthContext,
  input: {
    clientMutationId: string
    id?: string | null
    teamId: string
    name: string
    description?: string | null
    summary?: string | null
    status?: string | null
    health?: string | null
    area?: string | null
    leadId?: string | null
    startAt?: number | null
    targetAt?: number | null
    teamIds?: string[] | null
  },
): Promise<ProjectPayload> {
  try {
    await assertWorkspaceMember(ctx)
    const existing = await readReceipt<ProjectPayload>(
      ctx.db,
      ctx.workspaceId,
      input.clientMutationId,
    )
    if (existing) return existing
    await assertTeamAccess(ctx, input.teamId)
    const name = input.name.trim()
    if (!name) {
      return {
        success: false,
        clientMutationId: input.clientMutationId,
        project: null,
        lastSyncId: null,
        error: 'name is required',
      }
    }
    return finish(ctx, await ctx.db.transaction(async (db) => {
      const inner = { ...ctx, db }
      const id = input.id?.trim() || newId('project')
      const now = Date.now()
      await db.query(
        `INSERT INTO projects (
           id, workspace_id, team_id, name, description, summary, status, health, area,
           lead_id, start_at, target_at, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [
          id,
          ctx.workspaceId,
          input.teamId,
          name,
          input.description ?? '',
          input.summary ?? '',
          input.status ?? 'planned',
          input.health ?? 'no-update',
          input.area ?? '',
          input.leadId ?? null,
          input.startAt ?? null,
          input.targetAt ?? null,
          now,
        ],
      )
      const teamIds = uniqueIds([input.teamId, ...(input.teamIds ?? [])])
      for (const teamId of teamIds) {
        await db.query(
          `INSERT INTO project_teams (workspace_id, project_id, team_id) VALUES ($1,$2,$3)`,
          [ctx.workspaceId, id, teamId],
        )
      }
      const project = await loadProject(db, ctx.workspaceId, id)
      const sequence = await writeChange(db, inner, {
        entityType: 'project',
        entityId: id,
        operation: 'insert',
        revision: 1,
        changedFields: ['*'],
        payload: project,
        teamId: input.teamId,
        clientMutationId: input.clientMutationId,
      })
      const result: ProjectPayload = {
        success: true,
        clientMutationId: input.clientMutationId,
        project,
        lastSyncId: sequence,
        error: null,
      }
      await writeReceipt(db, inner, input.clientMutationId, 'project', id, 1, result)
      return result
    }))
  } catch (error) {
    return {
      success: false,
      clientMutationId: input.clientMutationId,
      project: null,
      lastSyncId: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function projectUpdate(
  ctx: AuthContext,
  input: {
    clientMutationId: string
    id: string
    name?: string | null
    description?: string | null
    summary?: string | null
    status?: string | null
    health?: string | null
    area?: string | null
    leadId?: string | null
    startAt?: number | null
    targetAt?: number | null
    teamIds?: string[] | null
  },
): Promise<ProjectPayload> {
  try {
    await assertWorkspaceMember(ctx)
    const existing = await readReceipt<ProjectPayload>(
      ctx.db,
      ctx.workspaceId,
      input.clientMutationId,
    )
    if (existing) return existing
    return finish(ctx, await ctx.db.transaction(async (db) => {
      const inner = { ...ctx, db }
      const current = await loadProject(db, ctx.workspaceId, input.id)
      if (!current) {
        return {
          success: false,
          clientMutationId: input.clientMutationId,
          project: null,
          lastSyncId: null,
          error: 'project not found',
        }
      }
      await assertTeamAccess(inner, current.teamId)
      const now = Date.now()
      await db.query(
        `UPDATE projects SET
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           summary = COALESCE($4, summary),
           status = COALESCE($5, status),
           health = COALESCE($6, health),
           area = COALESCE($7, area),
           lead_id = COALESCE($8, lead_id),
           start_at = COALESCE($9, start_at),
           target_at = COALESCE($10, target_at),
           updated_at = $11
         WHERE id = $1`,
        [
          current.id,
          input.name ?? null,
          input.description ?? null,
          input.summary ?? null,
          input.status ?? null,
          input.health ?? null,
          input.area ?? null,
          input.leadId === undefined ? current.leadId : input.leadId,
          input.startAt === undefined ? current.startAt : input.startAt,
          input.targetAt === undefined ? current.targetAt : input.targetAt,
          now,
        ],
      )
      if (input.teamIds) {
        await db.query(`DELETE FROM project_teams WHERE project_id = $1`, [current.id])
        for (const teamId of uniqueIds([current.teamId, ...input.teamIds])) {
          await db.query(
            `INSERT INTO project_teams (workspace_id, project_id, team_id) VALUES ($1,$2,$3)`,
            [ctx.workspaceId, current.id, teamId],
          )
        }
      }
      const project = await loadProject(db, ctx.workspaceId, current.id)
      const sequence = await writeChange(db, inner, {
        entityType: 'project',
        entityId: current.id,
        operation: 'update',
        revision: 1,
        changedFields: ['project'],
        payload: project,
        teamId: current.teamId,
        clientMutationId: input.clientMutationId,
      })
      const result: ProjectPayload = {
        success: true,
        clientMutationId: input.clientMutationId,
        project,
        lastSyncId: sequence,
        error: null,
      }
      await writeReceipt(db, inner, input.clientMutationId, 'project', current.id, 1, result)
      return result
    }))
  } catch (error) {
    return {
      success: false,
      clientMutationId: input.clientMutationId,
      project: null,
      lastSyncId: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}
