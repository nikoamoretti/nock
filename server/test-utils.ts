import { LiveHub } from './live.ts'
import { openDatabase, type Database } from './db.ts'
import { seedPrivateTeam, seedWorkspace } from './fixtures.ts'
import { migrate } from './migrate.ts'
import { createNockYoga } from './yoga.ts'
import type { AuthContext } from './auth.ts'

export async function createTestDb(): Promise<Database> {
  const db = await openDatabase()
  await migrate(db)
  return db
}

export async function createSeededTestApp(options?: { demo?: boolean }) {
  const db = await createTestDb()
  const hub = new LiveHub()
  const ctx = await seedWorkspace(db, { demo: options?.demo ?? true })
  ctx.hub = hub
  const yoga = await createNockYoga(db, hub)
  return { db, ctx, yoga, hub }
}

export async function graphqlRequest<T>(
  yoga: Awaited<ReturnType<typeof createNockYoga>>,
  query: string,
  variables?: Record<string, unknown>,
  ctx?: Partial<AuthContext>,
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ctx?.userId) headers['x-nock-user-id'] = ctx.userId
  if (ctx?.workspaceId) headers['x-nock-workspace-id'] = ctx.workspaceId
  const response = await yoga.fetch('http://nock.test/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  return (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
}

export { seedPrivateTeam }
