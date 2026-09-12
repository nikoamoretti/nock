import type { Database } from './db.ts'
import type { LiveHub } from './live.ts'

export type AuthContext = {
  db: Database
  userId: string
  workspaceId: string
  hub?: LiveHub
}

export class DomainError extends Error {
  code: string
  constructor(message: string, code = 'DOMAIN') {
    super(message)
    this.code = code
    this.name = 'DomainError'
  }
}

export async function assertWorkspaceMember(ctx: AuthContext): Promise<void> {
  const row = await ctx.db.query(
    `SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2`,
    [ctx.workspaceId, ctx.userId],
  )
  if (!row.rows[0]) {
    throw new DomainError('not a workspace member', 'FORBIDDEN')
  }
}

export async function assertTeamAccess(ctx: AuthContext, teamId: string): Promise<void> {
  await assertWorkspaceMember(ctx)
  const team = await ctx.db.query<{ private: boolean; workspace_id: string }>(
    `SELECT private, workspace_id FROM teams WHERE id = $1`,
    [teamId],
  )
  const found = team.rows[0]
  if (!found || found.workspace_id !== ctx.workspaceId) {
    throw new DomainError('team not found', 'NOT_FOUND')
  }
  if (!found.private) return
  const member = await ctx.db.query(
    `SELECT 1 FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
    [teamId, ctx.userId],
  )
  if (!member.rows[0]) {
    throw new DomainError('private team', 'FORBIDDEN')
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
