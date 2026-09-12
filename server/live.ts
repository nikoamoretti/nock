import { type Database } from './db.ts'
import { mapChange, type WorkspaceChangeRecord } from './map.ts'

export type LiveMessage =
  | { type: 'change'; change: WorkspaceChangeRecord }
  | { type: 'revoke'; teamId: string }

export type LiveSubscriber = {
  userId: string
  workspaceId: string
  send: (message: LiveMessage) => void
}

export class LiveHub {
  subscribers = new Set<LiveSubscriber>()

  subscribe(subscriber: LiveSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  async publish(
    change: WorkspaceChangeRecord,
    canSee: (userId: string, teamId: string | null) => Promise<boolean>,
  ): Promise<number> {
    let delivered = 0
    for (const subscriber of this.subscribers) {
      if (subscriber.workspaceId !== change.workspaceId) continue
      if (!(await canSee(subscriber.userId, change.authorizationTeamId))) continue
      subscriber.send({ type: 'change', change })
      delivered += 1
    }
    return delivered
  }

  revoke(workspaceId: string, userId: string, teamId: string): void {
    for (const subscriber of this.subscribers) {
      if (subscriber.workspaceId !== workspaceId || subscriber.userId !== userId) continue
      subscriber.send({ type: 'revoke', teamId })
    }
  }
}

export const liveHub = new LiveHub()

export async function userCanSeeTeam(
  db: Database,
  workspaceId: string,
  userId: string,
  teamId: string | null,
): Promise<boolean> {
  const member = await db.query(
    `SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  )
  if (!member.rows[0]) return false
  if (!teamId) return true
  const team = await db.query<{ private: boolean }>(
    `SELECT private FROM teams WHERE id = $1 AND workspace_id = $2`,
    [teamId, workspaceId],
  )
  if (!team.rows[0]) return false
  if (!team.rows[0].private) return true
  const teamMember = await db.query(
    `SELECT 1 FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId],
  )
  return Boolean(teamMember.rows[0])
}

export async function loadChange(
  db: Database,
  workspaceId: string,
  sequence: number,
): Promise<WorkspaceChangeRecord | null> {
  const result = await db.query(
    `SELECT * FROM workspace_changes WHERE workspace_id = $1 AND sequence = $2`,
    [workspaceId, sequence],
  )
  const row = result.rows[0]
  return row ? mapChange(row) : null
}

export async function fetchWorkspaceChanges(
  db: Database,
  workspaceId: string,
  userId: string,
  after: number,
  first: number,
): Promise<{ nodes: WorkspaceChangeRecord[]; hasNextPage: boolean; checkpoint: number }> {
  const limit = Math.min(Math.max(first, 1), 1000)
  const result = await db.query(
    `SELECT c.*
     FROM workspace_changes c
     WHERE c.workspace_id = $1
       AND c.sequence > $2
       AND (
         c.authorization_team_id IS NULL OR
         EXISTS (
           SELECT 1 FROM teams t
           WHERE t.id = c.authorization_team_id AND t.workspace_id = $1 AND t.private = false
         ) OR
         EXISTS (
           SELECT 1 FROM team_memberships m
           WHERE m.team_id = c.authorization_team_id AND m.user_id = $3
         )
       )
     ORDER BY c.sequence
     LIMIT $4`,
    [workspaceId, after, userId, limit + 1],
  )
  const nodes = result.rows.slice(0, limit).map((row) => mapChange(row))
  const last = nodes[nodes.length - 1]?.sequence ?? after
  return {
    nodes,
    hasNextPage: result.rows.length > limit,
    checkpoint: last,
  }
}

export async function publishSequence(
  ctx: { db: Database; workspaceId: string; hub?: LiveHub },
  sequence: number | null,
): Promise<void> {
  if (!sequence || !ctx.hub) return
  const change = await loadChange(ctx.db, ctx.workspaceId, sequence)
  if (!change) return
  await ctx.hub.publish(change, (userId, teamId) =>
    userCanSeeTeam(ctx.db, ctx.workspaceId, userId, teamId),
  )
}
