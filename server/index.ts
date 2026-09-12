import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from './db.ts'
import { seedWorkspace } from './fixtures.ts'
import { liveHub, type LiveHub } from './live.ts'
import { migrate } from './migrate.ts'
import { rolloverEndedCycles } from './jobs/cycle-rollover.ts'
import { handleIntegrationRequest } from './integrations/http.ts'
import { attachSyncSocket } from './ws.ts'
import { createNockYoga } from './yoga.ts'

export const DEFAULT_API_PORT = 8787

export async function startApiServer(options?: {
  port?: number
  dataDir?: string
  seedDemo?: boolean
  ephemeral?: boolean
  hub?: LiveHub
}): Promise<{ url: string; wsUrl: string; close: () => Promise<void> }> {
  const port = options?.port ?? Number(process.env.NOCK_API_PORT ?? DEFAULT_API_PORT)
  const ephemeral = options?.ephemeral ?? false
  const dataDir = ephemeral
    ? undefined
    : (options?.dataDir ?? process.env.NOCK_PG_DIR ?? resolve('.nock/pglite'))
  if (dataDir) await mkdir(dataDir, { recursive: true })
  const db = await openDatabase(dataDir ? { dataDir } : undefined)
  await migrate(db)
  const hub = options?.hub ?? liveHub
  const ctx = await seedWorkspace(db, { demo: options?.seedDemo ?? true })
  ctx.hub = hub
  try {
    const rolled = await rolloverEndedCycles(db)
    if (rolled > 0) console.log(`[nock] rolled ${rolled} issues into a new cycle`)
  } catch (error) {
    console.warn('[nock] cycle rollover skipped', error)
  }
  const yoga = await createNockYoga(db, hub)
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/integrations/')) {
      void handleIntegrationRequest(req, res, ctx)
      return
    }
    void yoga(req, res)
  })
  attachSyncSocket(server, db, hub)
  await new Promise<void>((resolveListen, reject) => {
    server.listen(port, '127.0.0.1', () => resolveListen())
    server.on('error', reject)
  })
  const address = server.address() as AddressInfo | null
  const actualPort = address?.port ?? port
  const url = `http://127.0.0.1:${actualPort}/graphql`
  const wsUrl = `ws://127.0.0.1:${actualPort}/sync`
  console.log(`[nock] GraphQL listening on ${url}${dataDir ? ` (pglite ${dataDir})` : ' (memory)'}`)
  console.log(`[nock] sync websocket ${wsUrl}`)
  return {
    url,
    wsUrl,
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
