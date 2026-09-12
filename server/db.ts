import { PGlite } from '@electric-sql/pglite'

export type QueryResult<T> = { rows: T[]; rowCount: number }

export type Database = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>
  exec(sql: string): Promise<void>
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>
  close(): Promise<void>
}

function wrapPglite(client: PGlite): Database {
  const db: Database = {
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
      const result = await client.query<T>(text, params)
      return { rows: result.rows as T[], rowCount: result.rows.length }
    },
    async exec(sql: string) {
      await client.exec(sql)
    },
    async transaction<T>(fn: (inner: Database) => Promise<T>): Promise<T> {
      return client.transaction(async (tx) => {
        const inner: Database = {
          async query<R extends Record<string, unknown>>(text: string, params: unknown[] = []) {
            const result = await tx.query<R>(text, params)
            return { rows: result.rows as R[], rowCount: result.rows.length }
          },
          async exec(sql: string) {
            await tx.exec(sql)
          },
          async transaction<R>(nested: (d: Database) => Promise<R>): Promise<R> {
            return nested(inner)
          },
          async close() {},
        }
        return fn(inner)
      })
    },
    async close() {
      await client.close()
    },
  }
  return db
}

export async function openDatabase(options?: {
  dataDir?: string
}): Promise<Database> {
  const client = options?.dataDir ? new PGlite(options.dataDir) : new PGlite()
  await client.waitReady
  return wrapPglite(client)
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value !== '') return Number(value)
  return fallback
}

export function asString(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

export function asStringOrNull(value: unknown): string | null {
  if (value == null) return null
  return String(value)
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}
