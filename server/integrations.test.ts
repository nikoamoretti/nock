import { describe, expect, it } from 'vitest'
import { IDS } from '../src/lib/seed.ts'
import { githubCommands } from '../src/lib/integrations.ts'
import { nockSignature } from './integrations/hmac.ts'
import { ingestInbound } from './integrations/inbound.ts'
import { attemptDelivery, enqueueWebhook, replayDelivery, type OutboundFetch } from './integrations/outbound.ts'
import { STUB_PROVIDERS } from './integrations/adapters.ts'
import { createSeededTestApp } from './test-utils.ts'

describe('integrations server', () => {
  it('accepts a signed GitHub pull request, links the issue, and starts it', async () => {
    const app = await createSeededTestApp({ demo: true })
    const issue = await app.db.query<{ id: string; identifier: string; state_id: string }>(
      `SELECT id, identifier, state_id FROM issues WHERE workspace_id = $1 AND identifier = 'ENG-1'`,
      [app.ctx.workspaceId],
    )
    expect(issue.rows[0]?.identifier).toBe('ENG-1')
    const now = Date.now()
    const payload = {
      action: 'opened',
      pull_request: {
        number: 9,
        title: 'Fix ENG-1 from GitHub',
        html_url: 'https://github.com/acme/nock/pull/9',
        merged: false,
        head: { ref: 'eng-1-github' },
      },
    }
    const rawBody = JSON.stringify(payload)
    const deliveryId = 'gh-del-1'
    const signature = nockSignature('nock-dev-secret', deliveryId, now, rawBody)
    const accepted = await ingestInbound({
      db: app.db,
      ctx: app.ctx,
      provider: 'github',
      rawBody,
      headers: {
        deliveryId,
        timestamp: now,
        signature,
        eventType: 'pull_request',
      },
      now,
      processAsync: false,
    })
    expect(accepted.status).toBe(202)
    const replay = await ingestInbound({
      db: app.db,
      ctx: app.ctx,
      provider: 'github',
      rawBody,
      headers: {
        deliveryId,
        timestamp: now,
        signature,
        eventType: 'pull_request',
      },
      now,
      processAsync: false,
    })
    expect(replay.status).toBe(409)
    const stale = await ingestInbound({
      db: app.db,
      ctx: app.ctx,
      provider: 'github',
      rawBody,
      headers: {
        deliveryId: 'gh-del-stale',
        timestamp: now - 10 * 60_000,
        signature: nockSignature('nock-dev-secret', 'gh-del-stale', now - 10 * 60_000, rawBody),
        eventType: 'pull_request',
      },
      now,
      processAsync: false,
    })
    expect(stale.status).toBe(400)
    const links = await app.db.query<{ url: string; title: string }>(
      `SELECT url, title FROM external_links WHERE issue_id = $1`,
      [issue.rows[0]!.id],
    )
    expect(links.rows[0]?.url).toContain('/pull/9')
    const columns = await app.db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'issues'`,
    )
    expect(columns.rows.map((row) => row.column_name)).not.toContain('github_pr_url')
    const started = await app.db.query<{ type: string }>(
      `SELECT s.type FROM issues i JOIN workflow_states s ON s.id = i.state_id WHERE i.id = $1`,
      [issue.rows[0]!.id],
    )
    expect(started.rows[0]?.type).toBe('started')
    expect(githubCommands('pull_request', payload).length).toBeGreaterThan(0)
    await app.db.close()
  })

  it('delivers outbound webhooks with HMAC, backs off, disables, and replays', async () => {
    const app = await createSeededTestApp({ demo: false })
    const deliveryId = await enqueueWebhook({
      db: app.db,
      workspaceId: app.ctx.workspaceId,
      subscriptionId: 'wh_local',
      eventType: 'issue.update',
      payload: { id: 'issue_1', title: 'Hello' },
    })
    let calls = 0
    const failing: OutboundFetch = async () => {
      calls += 1
      return { ok: false, status: 500, text: async () => 'nope' }
    }
    for (let index = 0; index < 8; index += 1) {
      await attemptDelivery(app.ctx, deliveryId, failing)
    }
    expect(calls).toBe(8)
    const sub = await app.db.query<{ fail_count: unknown; disabled_at: unknown }>(
      `SELECT fail_count, disabled_at FROM webhook_subscriptions WHERE id = 'wh_local'`,
    )
    expect(Number(sub.rows[0]?.fail_count)).toBe(8)
    expect(sub.rows[0]?.disabled_at).not.toBeNull()

    await app.db.query(
      `UPDATE webhook_subscriptions SET disabled_at = NULL, fail_count = 0 WHERE id = 'wh_local'`,
    )
    const ok: OutboundFetch = async (url, init) => {
      expect(String(url)).toContain('example.test')
      const headers = new Headers(init?.headers)
      expect(headers.get('x-nock-signature')).toBeTruthy()
      expect(headers.get('x-nock-delivery-id')).toBe(deliveryId)
      return { ok: true, status: 200, text: async () => 'ok' }
    }
    const replayed = await replayDelivery(app.ctx, deliveryId, ok)
    expect(replayed.status).toBe('delivered')
    expect(STUB_PROVIDERS).toContain('gitlab')
    expect(IDS.userMe).toBeTruthy()
    await app.db.close()
  })
})
