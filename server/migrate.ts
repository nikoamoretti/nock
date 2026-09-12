import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from './db.ts'

const here = dirname(fileURLToPath(import.meta.url))

export const MIGRATIONS = [
  { id: '001_init', file: '001_init.sql' },
  { id: '002_planning', file: '002_planning.sql' },
  { id: '003_integrations', file: '003_integrations.sql' },
] as const

export async function migrate(db: Database): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at bigint NOT NULL
    )
  `)
  const applied: string[] = []
  for (const migration of MIGRATIONS) {
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM schema_migrations WHERE id = $1',
      [migration.id],
    )
    if (existing.rows[0]) continue
    const sql = await readFile(join(here, 'sql', migration.file), 'utf8')
    await db.transaction(async (tx) => {
      await tx.exec(sql)
      await tx.query(
        'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [migration.id, Date.now()],
      )
    })
    applied.push(migration.id)
  }
  return applied
}

export async function requiredTables(db: Database): Promise<string[]> {
  const result = await db.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_catalog.pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  )
  return result.rows.map((row) => row.tablename)
}
