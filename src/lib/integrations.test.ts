import { describe, expect, it } from 'vitest'
import {
  adapterStub,
  githubCommands,
  INTEGRATION_PROVIDERS,
  nextBackoffMs,
  parseIssueKeys,
  shouldDisableEndpoint,
  verifyInboundEnvelope,
} from './integrations'

describe('integrations', () => {
  it('parses issue keys from branches and PR titles', () => {
    expect(parseIssueKeys('eng-12-fix-login')).toEqual(['ENG-12'])
    expect(parseIssueKeys('Fix ENG-12 and also ENG-12 again')).toEqual(['ENG-12'])
    expect(parseIssueKeys('no keys here')).toEqual([])
  })

  it('turns GitHub PR and commit events into domain commands without GitHub issue columns', () => {
    const opened = githubCommands('pull_request', {
      action: 'opened',
      pull_request: {
        number: 44,
        title: 'Fix ENG-12 login loop',
        html_url: 'https://github.com/acme/nock/pull/44',
        merged: false,
        head: { ref: 'eng-12-login' },
      },
    })
    expect(opened.some((command) => command.type === 'external.link' && command.externalId === '44')).toBe(
      true,
    )
    expect(opened.some((command) => command.type === 'issue.automate' && command.action === 'start')).toBe(
      true,
    )
    const merged = githubCommands('pull_request', {
      action: 'closed',
      pull_request: {
        number: 44,
        title: 'Fix ENG-12',
        html_url: 'https://github.com/acme/nock/pull/44',
        merged: true,
        head: { ref: 'eng-12-login' },
      },
    })
    expect(merged.some((command) => command.type === 'issue.automate' && command.action === 'complete')).toBe(
      true,
    )
    const commits = githubCommands('push', {
      commits: [{ id: 'abc', message: 'ENG-12 polish', url: 'https://github.com/acme/nock/commit/abc' }],
    })
    expect(commits[0]).toMatchObject({ type: 'external.link', issueIdentifier: 'ENG-12', metadata: { kind: 'commit' } })
  })

  it('rejects stale and replayed inbound envelopes', () => {
    const now = 1_000_000
    expect(
      verifyInboundEnvelope({ timestamp: now - 10_000, now, deliveryId: 'd1', seenDeliveryIds: [] }).ok,
    ).toBe(true)
    expect(
      verifyInboundEnvelope({ timestamp: now - 6 * 60_000, now, deliveryId: 'd1', seenDeliveryIds: [] }).error,
    ).toBe('stale timestamp')
    expect(
      verifyInboundEnvelope({ timestamp: now, now, deliveryId: 'd1', seenDeliveryIds: ['d1'] }).error,
    ).toBe('replayed delivery')
  })

  it('backs off and disables failing outbound endpoints', () => {
    expect(nextBackoffMs(1)).toBe(1000)
    expect(nextBackoffMs(4)).toBe(8000)
    expect(shouldDisableEndpoint(7)).toBe(false)
    expect(shouldDisableEndpoint(8)).toBe(true)
    expect(INTEGRATION_PROVIDERS).toEqual(['github', 'gitlab', 'slack', 'sentry', 'zendesk', 'front'])
    expect(adapterStub('gitlab').status).toBe('stub')
    expect(adapterStub('slack').provider).toBe('slack')
    expect(adapterStub('sentry').provider).toBe('sentry')
    expect(adapterStub('zendesk').provider).toBe('zendesk')
    expect(adapterStub('front').provider).toBe('front')
  })
})
