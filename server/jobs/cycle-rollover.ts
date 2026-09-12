import { isOpenType } from '../../src/lib/filters.ts'
import { cycleDurationMs } from '../../src/lib/planning.ts'
import { asNumber, type Database } from '../db.ts'

type CycleRow = {
  id: string
  workspace_id: string
  team_id: string
  number: unknown
  ends_at: unknown
}

type IssueRow = { id: string; state_id: string; cycle_id: string | null }
type StateRow = { id: string; type: string }
type TeamRow = { cycle_duration_weeks: unknown }

export async function rolloverEndedCycles(
  db: Database,
  now = Date.now(),
): Promise<number> {
  const due = await db.query<CycleRow>(
    `SELECT id, workspace_id, team_id, number, ends_at
     FROM cycles
     WHERE completed_at IS NULL AND ends_at < $1
     ORDER BY team_id, number`,
    [now],
  )
  let moved = 0
  for (const cycle of due.rows) {
    const team = await db.query<TeamRow>(
      `SELECT cycle_duration_weeks FROM teams WHERE id = $1`,
      [cycle.team_id],
    )
    const duration = cycleDurationMs(Number(team.rows[0]?.cycle_duration_weeks ?? 2))
    const number = asNumber(cycle.number) + 1
    const nextId = `cycle_${cycle.team_id}_${number}`
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM cycles WHERE team_id = $1 AND number = $2`,
      [cycle.team_id, number],
    )
    const nextCycleId = existing.rows[0]?.id ?? nextId
    if (!existing.rows[0]) {
      await db.query(
        `INSERT INTO cycles (
           id, workspace_id, team_id, number, starts_at, ends_at, completed_at,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$7)`,
        [
          nextCycleId,
          cycle.workspace_id,
          cycle.team_id,
          number,
          asNumber(cycle.ends_at),
          asNumber(cycle.ends_at) + duration,
          now,
        ],
      )
    }
    const states = await db.query<StateRow>(
      `SELECT id, type FROM workflow_states WHERE team_id = $1`,
      [cycle.team_id],
    )
    const typeById = new Map(states.rows.map((row) => [row.id, row.type]))
    const issues = await db.query<IssueRow>(
      `SELECT id, state_id, cycle_id FROM issues WHERE cycle_id = $1 AND archived_at IS NULL`,
      [cycle.id],
    )
    for (const issue of issues.rows) {
      const type = typeById.get(issue.state_id)
      if (!type || !isOpenType(type as never)) continue
      await db.query(
        `UPDATE issues SET cycle_id = $2, updated_at = $3 WHERE id = $1`,
        [issue.id, nextCycleId, now],
      )
      moved += 1
    }
    await db.query(
      `UPDATE cycles SET completed_at = $2, updated_at = $2 WHERE id = $1`,
      [cycle.id, now],
    )
  }
  return moved
}
