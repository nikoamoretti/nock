import { newId, type AuthContext } from '../auth.ts'
import { jsonParam, parseJson, type Database } from '../db.ts'
import { issueUpdate } from '../domain.ts'
import {
  githubCommands,
  type IntegrationCommand,
  type IntegrationProvider,
  verifyInboundEnvelope,
} from '../../src/lib/integrations.ts'
import { githubBodySignature, nockSignature, parseSignatureHeader, payloadHash, signaturesMatch } from './hmac.ts'

export type InboundHeaders = {
  deliveryId: string
  timestamp: number
  signature: string
  eventType: string
  githubSignature?: string
}

type InstallationRow = {
  id: string
  config: unknown
}

export function headersFrom(headers: Record<string, string | undefined>): InboundHeaders {
  const deliveryId = headers['x-nock-delivery-id'] ?? headers['x-github-delivery'] ?? ''
  const stamp = headers['x-nock-timestamp'] ?? headers['x-hub-timestamp']
  const timestamp = stamp ? Number(stamp) : Date.now()
  return {
    deliveryId,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    signature: parseSignatureHeader(headers['x-nock-signature']),
    githubSignature: headers['x-hub-signature-256'],
    eventType: headers['x-nock-event'] ?? headers['x-github-event'] ?? 'unknown',
  }
}

export async function ingestInbound(input: {
  db: Database
  ctx: AuthContext
  provider: IntegrationProvider
  rawBody: string
  headers: InboundHeaders
  now?: number
  processAsync?: boolean
}): Promise<{ status: number; body: { ok: boolean; error?: string; eventId?: string } }> {
  const now = input.now ?? Date.now()
  const installation = await loadInstallation(input.db, input.ctx.workspaceId, input.provider)
  if (!installation) return { status: 404, body: { ok: false, error: 'installation not found' } }
  const secret = String(installation.config.secret ?? '')
  if (!secret) return { status: 500, body: { ok: false, error: 'installation secret missing' } }

  const nockOk = signaturesMatch(
    nockSignature(secret, input.headers.deliveryId, input.headers.timestamp, input.rawBody),
    input.headers.signature,
  )
  const githubOk = input.headers.githubSignature
    ? signaturesMatch(githubBodySignature(secret, input.rawBody), input.headers.githubSignature)
    : false
  if (!nockOk && !githubOk) {
    return { status: 401, body: { ok: false, error: 'invalid signature' } }
  }

  const seen = await input.db.query<{ delivery_id: string }>(
    `SELECT delivery_id FROM inbound_receipts WHERE workspace_id = $1`,
    [input.ctx.workspaceId],
  )
  const envelope = verifyInboundEnvelope({
    timestamp: input.headers.timestamp,
    now,
    deliveryId: input.headers.deliveryId,
    seenDeliveryIds: seen.rows.map((row) => row.delivery_id),
  })
  if (!envelope.ok) return { status: envelope.status, body: { ok: false, error: envelope.error } }

  let payload: unknown
  try {
    payload = JSON.parse(input.rawBody) as unknown
  } catch {
    return { status: 400, body: { ok: false, error: 'invalid json' } }
  }

  const eventId = newId('evt')
  await input.db.query(
    `INSERT INTO inbound_receipts (
       id, workspace_id, installation_id, provider, delivery_id, timestamp_ms, payload_hash, status, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'accepted',$8)`,
    [
      newId('rcpt'),
      input.ctx.workspaceId,
      installation.id,
      input.provider,
      input.headers.deliveryId,
      input.headers.timestamp,
      payloadHash(input.rawBody),
      now,
    ],
  )
  await input.db.query(
    `INSERT INTO external_events (
       id, workspace_id, installation_id, provider, event_type, issue_id, payload, processed_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,NULL,$6::jsonb,NULL,$7)`,
    [
      eventId,
      input.ctx.workspaceId,
      installation.id,
      input.provider,
      input.headers.eventType,
      jsonParam(payload),
      now,
    ],
  )

  const work = processInboundEvent(input.ctx, {
    eventId,
    provider: input.provider,
    eventType: input.headers.eventType,
    payload,
  })
  if (input.processAsync === false) await work
  else {
    queueMicrotask(() => {
      void work.catch((error) => console.error('[nock] inbound process failed', error))
    })
  }
  return { status: 202, body: { ok: true, eventId } }
}

export async function processInboundEvent(
  ctx: AuthContext,
  input: {
    eventId: string
    provider: IntegrationProvider
    eventType: string
    payload: unknown
  },
): Promise<void> {
  const commands =
    input.provider === 'github' ? githubCommands(input.eventType, input.payload) : []
  for (const command of commands) {
    await ctx.db.query(
      `INSERT INTO integration_commands (
         id, workspace_id, event_id, command_type, payload, created_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [newId('icmd'), ctx.workspaceId, input.eventId, command.type, jsonParam(command), Date.now()],
    )
    await applyIntegrationCommand(ctx, command)
  }
  await ctx.db.query(`UPDATE external_events SET processed_at = $2 WHERE id = $1`, [
    input.eventId,
    Date.now(),
  ])
}

async function applyIntegrationCommand(ctx: AuthContext, command: IntegrationCommand): Promise<void> {
  const issue = await ctx.db.query<{ id: string; team_id: string; state_id: string }>(
    `SELECT id, team_id, state_id FROM issues
     WHERE workspace_id = $1 AND lower(identifier) = lower($2)`,
    [ctx.workspaceId, command.issueIdentifier],
  )
  const row = issue.rows[0]
  if (!row) return
  if (command.type === 'external.link') {
    await ctx.db.query(
      `INSERT INTO external_links (
         id, workspace_id, issue_id, project_id, provider, url, title, external_id, metadata, created_at
       ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8::jsonb,$9)`,
      [
        newId('elink'),
        ctx.workspaceId,
        row.id,
        'github',
        command.url,
        command.title,
        command.externalId,
        jsonParam(command.metadata),
        Date.now(),
      ],
    )
    return
  }
  if (command.type === 'activity.record') {
    await ctx.db.query(
      `INSERT INTO activity_events (id, workspace_id, issue_id, actor_id, kind, body, created_at)
       VALUES ($1,$2,$3,$4,'integration',$5,$6)`,
      [newId('act'), ctx.workspaceId, row.id, ctx.userId, command.body, Date.now()],
    )
    return
  }
  const want = command.action === 'complete' ? 'completed' : 'started'
  const state = await ctx.db.query<{ id: string }>(
    `SELECT id FROM workflow_states WHERE workspace_id = $1 AND team_id = $2 AND type = $3
     ORDER BY position LIMIT 1`,
    [ctx.workspaceId, row.team_id, want],
  )
  const stateId = state.rows[0]?.id
  if (!stateId || stateId === row.state_id) return
  await issueUpdate(ctx, {
    clientMutationId: `integration:${command.issueIdentifier}:${command.action}:${Date.now()}`,
    id: row.id,
    stateId,
  })
}

async function loadInstallation(
  db: Database,
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<{ id: string; config: Record<string, unknown> } | null> {
  const result = await db.query<InstallationRow>(
    `SELECT id, config FROM integration_installations
     WHERE workspace_id = $1 AND provider = $2 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [workspaceId, provider],
  )
  const row = result.rows[0]
  if (!row) return null
  return { id: row.id, config: parseJson(row.config, {}) }
}
