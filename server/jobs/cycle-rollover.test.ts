import { describe, expect, it } from 'vitest'
import { IDS } from '../../src/lib/seed.ts'
import { createSeededTestApp } from '../test-utils.ts'
import { rolloverEndedCycles } from './cycle-rollover.ts'

describe('cycle rollover job', () => {
  it('moves open issues from an ended cycle into the next one', async () => {
    const app = await createSeededTestApp({ demo: false })
    const now = Date.now()
    await app.db.query(
      `INSERT INTO issues (
         id, workspace_id, team_id, number, identifier, title, description, priority,
         state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
         sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
       ) VALUES ('iss_roll',$1,$2,40,'ENG-40','Still open','',0,$3,NULL,NULL,$4,NULL,NULL,NULL,1,1,NULL,$5,$5,NULL)`,
      [app.ctx.workspaceId, IDS.teamEng, IDS.stateTodo, IDS.cyclePrevious, now],
    )
    await app.db.query(
      `UPDATE cycles SET completed_at = NULL, ends_at = $2 WHERE id = $1`,
      [IDS.cyclePrevious, now - 1000],
    )
    const moved = await rolloverEndedCycles(app.db, now)
    expect(moved).toBeGreaterThanOrEqual(1)
    const issue = await app.db.query<{ cycle_id: string }>(
      `SELECT cycle_id FROM issues WHERE id = 'iss_roll'`,
    )
    expect(issue.rows[0]?.cycle_id).not.toBe(IDS.cyclePrevious)
    const prev = await app.db.query<{ completed_at: unknown }>(
      `SELECT completed_at FROM cycles WHERE id = $1`,
      [IDS.cyclePrevious],
    )
    expect(prev.rows[0]?.completed_at).not.toBeNull()
  })
})
