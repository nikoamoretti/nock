import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSchema, createYoga } from 'graphql-yoga'
import { IDS } from '../src/lib/seed.ts'
import type { AuthContext } from './auth.ts'
import type { Database } from './db.ts'
import { liveHub, type LiveHub } from './live.ts'
import { resolvers } from './resolvers.ts'

const here = dirname(fileURLToPath(import.meta.url))

export async function loadTypeDefs(): Promise<string> {
  return readFile(join(here, 'graphql/schema.graphql'), 'utf8')
}

export async function createNockSchema() {
  const typeDefs = await loadTypeDefs()
  return createSchema({ typeDefs, resolvers })
}

export async function createNockYoga(db: Database, hub: LiveHub = liveHub) {
  const schema = await createNockSchema()
  return createYoga<{ db: Database }>({
    schema,
    graphqlEndpoint: '/graphql',
    landingPage: false,
    graphiql: true,
    context: async ({ request }): Promise<AuthContext> => {
      const userId = request.headers.get('x-nock-user-id') || IDS.userMe
      const workspaceId = request.headers.get('x-nock-workspace-id') || IDS.workspace
      return { db, userId, workspaceId, hub }
    },
  })
}
