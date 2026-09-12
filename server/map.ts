import { asNumber, asString, asStringOrNull, parseJson, type Database } from './db.ts'

export type IssueRecord = {
  id: string
  workspaceId: string
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
  dueAt: number | null
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

type IssueRow = {
  id: string
  workspace_id: string
  team_id: string
  number: unknown
  identifier: string
  title: string
  description: string
  priority: unknown
  state_id: string
  assignee_id: string | null
  project_id: string | null
  cycle_id: string | null
  milestone_id: string | null
  parent_id: string | null
  due_at: unknown
  sort_order: unknown
  revision: unknown
  archived_at: unknown
  created_at: unknown
  updated_at: unknown
  last_mutation_id: string | null
}

export function mapIssueRow(row: IssueRow): Omit<
  IssueRecord,
  'labelIds' | 'subscriberIds' | 'relatedIssueIds' | 'blockedByIds' | 'duplicateOfId'
> {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    number: asNumber(row.number),
    identifier: row.identifier,
    title: row.title,
    description: row.description ?? '',
    priority: asNumber(row.priority) as IssueRecord['priority'],
    stateId: row.state_id,
    assigneeId: asStringOrNull(row.assignee_id),
    projectId: asStringOrNull(row.project_id),
    cycleId: asStringOrNull(row.cycle_id),
    milestoneId: asStringOrNull(row.milestone_id),
    parentId: asStringOrNull(row.parent_id),
    dueAt: row.due_at == null ? null : asNumber(row.due_at),
    archivedAt: row.archived_at == null ? null : asNumber(row.archived_at),
    sortOrder: asNumber(row.sort_order),
    revision: asNumber(row.revision),
    lastMutationId: asStringOrNull(row.last_mutation_id),
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  }
}

export async function loadIssue(
  db: Database,
  workspaceId: string,
  issueId: string,
): Promise<IssueRecord | null> {
  const result = await db.query<IssueRow>(
    `SELECT * FROM issues WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, issueId],
  )
  const row = result.rows[0]
  if (!row) return null
  return attachIssueJoins(db, workspaceId, mapIssueRow(row))
}

export async function loadIssues(
  db: Database,
  workspaceId: string,
  ids: string[],
): Promise<IssueRecord[]> {
  if (ids.length === 0) return []
  const result = await db.query<IssueRow>(
    `SELECT * FROM issues WHERE workspace_id = $1 AND id = ANY($2::text[])`,
    [workspaceId, ids],
  )
  const mapped = result.rows.map(mapIssueRow)
  return attachManyIssueJoins(db, workspaceId, mapped)
}

export async function attachIssueJoins(
  db: Database,
  workspaceId: string,
  issue: ReturnType<typeof mapIssueRow>,
): Promise<IssueRecord> {
  const [full] = await attachManyIssueJoins(db, workspaceId, [issue])
  return full
}

export async function attachManyIssueJoins(
  db: Database,
  workspaceId: string,
  issues: Array<ReturnType<typeof mapIssueRow>>,
): Promise<IssueRecord[]> {
  if (issues.length === 0) return []
  const ids = issues.map((issue) => issue.id)
  const labels = await db.query<{ issue_id: string; label_id: string }>(
    `SELECT issue_id, label_id FROM issue_labels WHERE workspace_id = $1 AND issue_id = ANY($2::text[])`,
    [workspaceId, ids],
  )
  const subscribers = await db.query<{ issue_id: string; user_id: string }>(
    `SELECT issue_id, user_id FROM issue_subscribers WHERE workspace_id = $1 AND issue_id = ANY($2::text[])`,
    [workspaceId, ids],
  )
  const relations = await db.query<{
    issue_id: string
    related_issue_id: string
    kind: string
  }>(
    `SELECT issue_id, related_issue_id, kind FROM issue_relations WHERE workspace_id = $1 AND issue_id = ANY($2::text[])`,
    [workspaceId, ids],
  )
  const labelMap = groupIds(labels.rows, 'issue_id', 'label_id')
  const subMap = groupIds(subscribers.rows, 'issue_id', 'user_id')
  const related = new Map<string, string[]>()
  const blocked = new Map<string, string[]>()
  const duplicate = new Map<string, string>()
  for (const row of relations.rows) {
    if (row.kind === 'related') pushMap(related, row.issue_id, row.related_issue_id)
    else if (row.kind === 'blocks') pushMap(blocked, row.issue_id, row.related_issue_id)
    else if (row.kind === 'duplicate') duplicate.set(row.issue_id, row.related_issue_id)
  }
  return issues.map((issue) => ({
    ...issue,
    labelIds: labelMap.get(issue.id) ?? [],
    subscriberIds: subMap.get(issue.id) ?? [],
    relatedIssueIds: related.get(issue.id) ?? [],
    blockedByIds: blocked.get(issue.id) ?? [],
    duplicateOfId: duplicate.get(issue.id) ?? null,
  }))
}

function groupIds(
  rows: Array<Record<string, string>>,
  key: string,
  value: string,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) pushMap(map, row[key], row[value])
  return map
}

function pushMap(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export type ProjectRecord = {
  id: string
  workspaceId: string
  teamId: string
  name: string
  description: string
  summary: string
  status: string
  health: string
  area: string
  leadId: string | null
  startAt: number | null
  targetAt: number | null
  teamIds: string[]
  memberIds: string[]
  createdAt: number
  updatedAt: number
}

export async function loadProject(
  db: Database,
  workspaceId: string,
  projectId: string,
): Promise<ProjectRecord | null> {
  const result = await db.query<{
    id: string
    workspace_id: string
    team_id: string
    name: string
    description: string
    summary: string
    status: string
    health: string
    area: string
    lead_id: string | null
    start_at: unknown
    target_at: unknown
    created_at: unknown
    updated_at: unknown
  }>(`SELECT * FROM projects WHERE workspace_id = $1 AND id = $2`, [workspaceId, projectId])
  const row = result.rows[0]
  if (!row) return null
  const teams = await db.query<{ team_id: string }>(
    `SELECT team_id FROM project_teams WHERE project_id = $1`,
    [projectId],
  )
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM project_members WHERE project_id = $1`,
    [projectId],
  )
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    name: row.name,
    description: row.description,
    summary: row.summary ?? '',
    status: row.status,
    health: row.health,
    area: row.area ?? '',
    leadId: asStringOrNull(row.lead_id),
    startAt: row.start_at == null ? null : asNumber(row.start_at),
    targetAt: row.target_at == null ? null : asNumber(row.target_at),
    teamIds: unique([row.team_id, ...teams.rows.map((item) => item.team_id)]),
    memberIds: members.rows.map((item) => item.user_id),
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  }
}

export type CommentRecord = {
  id: string
  workspaceId: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
  updatedAt: number
}

export function mapComment(row: {
  id: string
  workspace_id: string
  issue_id: string
  author_id: string
  body: string
  created_at: unknown
  updated_at: unknown
}): CommentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    issueId: row.issue_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  }
}

export type WorkspaceChangeRecord = {
  workspaceId: string
  sequence: number
  entityType: string
  entityId: string
  operation: string
  revision: number
  changedFields: string[]
  payload: unknown
  syncGroup: string | null
  authorizationTeamId: string | null
  actorId: string | null
  clientMutationId: string | null
  createdAt: number
}

export function mapChange(row: Record<string, unknown>): WorkspaceChangeRecord {
  return {
    workspaceId: asString(row.workspace_id),
    sequence: asNumber(row.sequence),
    entityType: asString(row.entity_type),
    entityId: asString(row.entity_id),
    operation: asString(row.operation),
    revision: asNumber(row.revision),
    changedFields: Array.isArray(row.changed_fields)
      ? row.changed_fields.map(String)
      : parseJson<string[]>(row.changed_fields, []),
    payload: parseJson(row.payload, null),
    syncGroup: asStringOrNull(row.sync_group),
    authorizationTeamId: asStringOrNull(row.authorization_team_id),
    actorId: asStringOrNull(row.actor_id),
    clientMutationId: asStringOrNull(row.client_mutation_id),
    createdAt: asNumber(row.created_at),
  }
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}
