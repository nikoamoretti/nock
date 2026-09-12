import { newId, type AuthContext } from '../auth.ts'
import { jsonParam, type Database } from '../db.ts'
import { nextBackoffMs, shouldDisableEndpoint } from '../../src/lib/integrations.ts'
import { nockSignature } from './hmac.ts'

export type OutboundFetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

export async function enqueueWebhook(input: {
  db: Database
  workspaceId: string
  subscriptionId: string
  eventType: string
  payload: unknown
  now?: number
}): Promise<string> {
  const sub = await input.db.query<{ url: string; secret: string; disabled_at: unknown }>(
    `SELECT url, secret, disabled_at FROM webhook_subscriptions WHERE id = $1 AND workspace_id = $2`,
    [input.subscriptionId, input.workspaceId],
  )
  const row = sub.rows[0]
  if (!row || row.disabled_at != null) throw new Error('subscription disabled')
  const now = input.now ?? Date.now()
  const deliveryId = newId('del')
  const body = JSON.stringify(input.payload)
  const signature = nockSignature(row.secret, deliveryId, now, body)
  await input.db.query(
    `INSERT INTO webhook_deliveries (
       id, workspace_id, subscription_id, delivery_id, event_type, timestamp_ms,
       payload, signature, status, attempt, last_error, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'queued',0,NULL,$9)`,
    [
      newId('wh'),
      input.workspaceId,
      input.subscriptionId,
      deliveryId,
      input.eventType,
      now,
      jsonParam(input.payload),
      signature,
      now,
    ],
  )
  return deliveryId
}

export async function attemptDelivery(
  ctx: AuthContext,
  deliveryId: string,
  fetchImpl: OutboundFetch = fetch,
): Promise<{ status: string; attempt: number }> {
  const row = await ctx.db.query<{
    id: string
    subscription_id: string
    delivery_id: string
    event_type: string
    timestamp_ms: unknown
    payload: unknown
    signature: string
    attempt: unknown
  }>(
    `SELECT id, subscription_id, delivery_id, event_type, timestamp_ms, payload, signature, attempt
     FROM webhook_deliveries WHERE workspace_id = $1 AND delivery_id = $2`,
    [ctx.workspaceId, deliveryId],
  )
  const delivery = row.rows[0]
  if (!delivery) throw new Error('delivery not found')
  const sub = await ctx.db.query<{ url: string; secret: string; fail_count: unknown; disabled_at: unknown }>(
    `SELECT url, secret, fail_count, disabled_at FROM webhook_subscriptions WHERE id = $1`,
    [delivery.subscription_id],
  )
  const subscription = sub.rows[0]
  if (!subscription) throw new Error('subscription not found')
  const attempt = Number(delivery.attempt) + 1
  const payload =
    typeof delivery.payload === 'string' ? delivery.payload : JSON.stringify(delivery.payload)
  try {
    const response = await fetchImpl(subscription.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nock-delivery-id': delivery.delivery_id,
        'x-nock-timestamp': String(delivery.timestamp_ms),
        'x-nock-signature': delivery.signature,
        'x-nock-event': delivery.event_type,
      },
      body: payload,
    })
    if (!response.ok) throw new Error(`http ${response.status} ${await response.text()}`)
    await ctx.db.query(
      `UPDATE webhook_deliveries SET status = 'delivered', attempt = $2, last_error = NULL WHERE id = $1`,
      [delivery.id, attempt],
    )
    await ctx.db.query(
      `UPDATE webhook_subscriptions SET fail_count = 0, updated_at = $2 WHERE id = $1`,
      [delivery.subscription_id, Date.now()],
    )
    return { status: 'delivered', attempt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failCount = Number(subscription.fail_count) + 1
    const disabled = shouldDisableEndpoint(failCount)
    await ctx.db.query(
      `UPDATE webhook_deliveries SET status = 'failed', attempt = $2, last_error = $3 WHERE id = $1`,
      [delivery.id, attempt, message],
    )
    await ctx.db.query(
      `UPDATE webhook_subscriptions
       SET fail_count = $2, disabled_at = $3, updated_at = $4
       WHERE id = $1`,
      [delivery.subscription_id, failCount, disabled ? Date.now() : null, Date.now()],
    )
    return { status: 'failed', attempt }
  }
}

export async function replayDelivery(
  ctx: AuthContext,
  deliveryId: string,
  fetchImpl?: OutboundFetch,
): Promise<{ status: string; attempt: number }> {
  await ctx.db.query(
    `UPDATE webhook_deliveries SET status = 'queued' WHERE workspace_id = $1 AND delivery_id = $2`,
    [ctx.workspaceId, deliveryId],
  )
  return attemptDelivery(ctx, deliveryId, fetchImpl)
}

export { nextBackoffMs }
