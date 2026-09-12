import { describe, expect, it } from 'vitest'
import { FIXTURE_TABLES } from '../src/lib/fixtures/index.ts'
import { createTestDb } from './test-utils.ts'

const REQUIRED_INDEXES = [
  'issues_workspace_updated_idx',
  'issues_team_status_sort_idx',
  'issues_assignee_idx',
  'issues_project_idx',
  'issues_cycle_idx',
  'issues_parent_idx',
  'issues_due_idx',
  'issue_labels_label_idx',
  'issues_active_updated_idx',
  'issues_active_team_idx',
  'issues_search_identifier_idx',
  'issues_search_title_idx',
]

describe('postgres schema', () => {
  it('creates every tenant entity table', async () => {
    const db = await createTestDb()
    const tables = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`,
    )
    const names = new Set(tables.rows.map((row) => row.tablename))
    for (const table of FIXTURE_TABLES) {
      expect(names.has(table), `missing table ${table}`).toBe(true)
    }
    await db.close()
  })

  it('indexes workspace, team/status/sort, assignee, project, cycle, parent, due, labels, active, search', async () => {
    const db = await createTestDb()
    const indexes = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = 'public'`,
    )
    const names = new Set(indexes.rows.map((row) => row.indexname))
    for (const index of REQUIRED_INDEXES) {
      expect(names.has(index), `missing index ${index}`).toBe(true)
    }
    await db.close()
  })

  it('applies the planning relations migration', async () => {
    const db = await createTestDb()
    const applied = await db.query<{ id: string }>(
      `SELECT id FROM schema_migrations ORDER BY id`,
    )
    expect(applied.rows.map((row) => row.id)).toContain('002_planning')
    expect(applied.rows.map((row) => row.id)).toContain('003_integrations')
    const tables = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`,
    )
    expect(tables.rows.map((row) => row.tablename)).toContain('project_relations')
    expect(tables.rows.map((row) => row.tablename)).toContain('inbound_receipts')
    await db.close()
  })

  it('enforces one team, team-local number, and state/team membership', async () => {
    const db = await createTestDb()
    const { seedWorkspace } = await import('./fixtures.ts')
    const ctx = await seedWorkspace(db, { demo: false })
    const now = Date.now()
    await db.query(
      `INSERT INTO issues (
         id, workspace_id, team_id, number, identifier, title, description, priority,
         state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
         sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
       ) VALUES ('iss_a',$1,'team_eng',1,'ENG-1','A','',0,'state_todo',NULL,NULL,NULL,NULL,NULL,NULL,1,1,NULL,$2,$2,NULL)`,
      [ctx.workspaceId, now],
    )
    await expect(
      db.query(
        `INSERT INTO issues (
           id, workspace_id, team_id, number, identifier, title, description, priority,
           state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
           sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
         ) VALUES ('iss_b',$1,'team_eng',1,'ENG-1b','B','',0,'state_todo',NULL,NULL,NULL,NULL,NULL,NULL,2,1,NULL,$2,$2,NULL)`,
        [ctx.workspaceId, now],
      ),
    ).rejects.toThrow()
    await db.close()
  })

  it('rejects a state from another team', async () => {
    const db = await createTestDb()
    const { seedWorkspace, seedPrivateTeam } = await import('./fixtures.ts')
    const ctx = await seedWorkspace(db, { demo: false })
    const other = await seedPrivateTeam(db, ctx.workspaceId, { memberIds: [ctx.userId] })
    const now = Date.now()
    await expect(
      db.query(
        `INSERT INTO issues (
           id, workspace_id, team_id, number, identifier, title, description, priority,
           state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
           sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
         ) VALUES ('iss_cross',$1,'team_eng',9,'ENG-9','X','',0,$3,NULL,NULL,NULL,NULL,NULL,NULL,1,1,NULL,$2,$2,NULL)`,
        [ctx.workspaceId, now, `${other}_todo`],
      ),
    ).rejects.toThrow()
    await db.close()
  })
})
