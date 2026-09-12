import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { openDatabase } from './db.ts'
import { seedWorkspace } from './fixtures.ts'
import { migrate } from './migrate.ts'
import { createNockYoga } from './yoga.ts'

export const DEFAULT_API_PORT = 8787

export async function startApiServer(options?: {
  port?: number
  dataDir?: string
  seedDemo?: boolean
}): Promise<{ url: string; close: () => Promise<void> }> {
  const port = options?.port ?? Number(process.env.NOCK_API_PORT ?? DEFAULT_API_PORT)
  const dataDir = options?.dataDir ?? process.env.NOCK_PG_DIR ?? resolve('.nock/pglite')
  await mkdir(dataDir, { recursive: true })
  const db = await openDatabase({ dataDir })
  await migrate(db)
  await seedWorkspace(db, { demo: options?.seedDemo ?? true })
  const yoga = await createNockYoga(db)
  const server = createServer((req, res) => {
    void yoga(req, res)
  })
  await new Promise<void>((resolveListen, reject) => {
    server.listen(port, '127.0.0.1', () => resolveListen())
    server.on('error', reject)
  })
  const url = `http://127.0.0.1:${port}/graphql`
  console.log(`[nock] GraphQL listening on ${url} (pglite ${dataDir})`)
  return {
    url,
    close: async () => {
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()))
      })
      await db.close()
    },
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  await startApiServer()
}
