import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthContext } from '../auth.ts'
import type { IntegrationProvider } from '../../src/lib/integrations.ts'
import { headersFrom, ingestInbound } from './inbound.ts'
import { replayDelivery } from './outbound.ts'

function headerMap(req: IncomingMessage): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value
  }
  return headers
}

async function readRaw(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleIntegrationRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://nock.local')
  if (!url.pathname.startsWith('/integrations/')) return false

  if (req.method === 'POST' && url.pathname === '/integrations/webhooks/replay') {
    const raw = await readRaw(req)
    let deliveryId = ''
    try {
      deliveryId = String((JSON.parse(raw) as { deliveryId?: string }).deliveryId ?? '')
    } catch {
      send(res, 400, { ok: false, error: 'invalid json' })
      return true
    }
    const result = await replayDelivery(ctx, deliveryId)
    send(res, 200, { ok: true, ...result })
    return true
  }

  const match = url.pathname.match(/^\/integrations\/([a-z]+)\/webhook$/)
  if (req.method === 'POST' && match) {
    const provider = match[1] as IntegrationProvider
    const rawBody = await readRaw(req)
    const result = await ingestInbound({
      db: ctx.db,
      ctx,
      provider,
      rawBody,
      headers: headersFrom(headerMap(req)),
    })
    send(res, result.status, result.body)
    return true
  }

  send(res, 404, { ok: false, error: 'not found' })
  return true
}
