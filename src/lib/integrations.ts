export type IntegrationProvider =
  | 'github'
  | 'gitlab'
  | 'slack'
  | 'sentry'
  | 'zendesk'
  | 'front'

export type IntegrationInstallation = {
  id: string
  workspaceId: string
  provider: IntegrationProvider
  externalId: string | null
  status: 'active' | 'disabled'
  config: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export type ExternalIdentity = {
  id: string
  installationId: string
  provider: IntegrationProvider
  externalUserId: string
  userId: string | null
  createdAt: number
}

export type ExternalLink = {
  id: string
  issueId: string | null
  projectId: string | null
  provider: IntegrationProvider
  url: string
  title: string
  externalId: string | null
  metadata: Record<string, unknown>
  createdAt: number
}

export type ExternalEvent = {
  id: string
  installationId: string | null
  provider: IntegrationProvider
  eventType: string
  issueId: string | null
  payload: Record<string, unknown>
  createdAt: number
}

export type IntegrationCommand =
  | {
      type: 'external.link'
      issueIdentifier: string
      url: string
      title: string
      externalId: string | null
      metadata: Record<string, unknown>
    }
  | {
      type: 'issue.automate'
      issueIdentifier: string
      action: 'start' | 'complete'
      reason: string
    }
  | {
      type: 'activity.record'
      issueIdentifier: string
      body: string
    }

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  'github',
  'gitlab',
  'slack',
  'sentry',
  'zendesk',
  'front',
]

export const STALE_WEBHOOK_MS = 5 * 60 * 1000
export const WEBHOOK_DISABLE_AFTER = 8

export function parseIssueKeys(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\b/gi)) {
    found.add(match[1]!.toUpperCase())
  }
  return [...found]
}

export function nextBackoffMs(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1))
}

export function shouldDisableEndpoint(failCount: number): boolean {
  return failCount >= WEBHOOK_DISABLE_AFTER
}

export function adapterStub(provider: Exclude<IntegrationProvider, 'github'>): {
  provider: IntegrationProvider
  status: 'stub'
} {
  return { provider, status: 'stub' }
}

export function verifyInboundEnvelope(input: {
  timestamp: number
  now?: number
  deliveryId: string
  seenDeliveryIds: Iterable<string>
}): { ok: true } | { ok: false; status: number; error: string } {
  const now = input.now ?? Date.now()
  if (!input.deliveryId) return { ok: false, status: 400, error: 'missing delivery id' }
  if (Math.abs(now - input.timestamp) > STALE_WEBHOOK_MS) {
    return { ok: false, status: 400, error: 'stale timestamp' }
  }
  for (const seen of input.seenDeliveryIds) {
    if (seen === input.deliveryId) {
      return { ok: false, status: 409, error: 'replayed delivery' }
    }
  }
  return { ok: true }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function githubCommands(eventType: string, payload: unknown): IntegrationCommand[] {
  const body = asRecord(payload)
  if (eventType === 'pull_request' || eventType === 'pull_request_review') {
    const pr = asRecord(body.pull_request)
    const head = asRecord(pr.head)
    const title = asString(pr.title)
    const branch = asString(head.ref)
    const url = asString(pr.html_url)
    const number = pr.number != null ? String(pr.number) : null
    const merged = pr.merged === true || asString(body.action) === 'closed' && pr.merged === true
    const action = asString(body.action)
    const keys = parseIssueKeys(`${title} ${branch}`)
    const commands: IntegrationCommand[] = []
    for (const key of keys) {
      commands.push({
        type: 'external.link',
        issueIdentifier: key,
        url: url || `https://github.com/pull/${number ?? ''}`,
        title: title ? `PR: ${title}` : `Pull request ${number ?? ''}`.trim(),
        externalId: number,
        metadata: {
          kind: 'pull_request',
          reviewState: eventType === 'pull_request_review' ? asString(asRecord(body.review).state) : asString(pr.mergeable_state),
          branch,
          merged,
          action,
        },
      })
      if (action === 'opened' || action === 'reopened') {
        commands.push({
          type: 'issue.automate',
          issueIdentifier: key,
          action: 'start',
          reason: 'GitHub pull request opened',
        })
      }
      if (action === 'closed' && merged) {
        commands.push({
          type: 'issue.automate',
          issueIdentifier: key,
          action: 'complete',
          reason: 'GitHub pull request merged',
        })
      }
      if (action === 'review_requested' || eventType === 'pull_request_review') {
        commands.push({
          type: 'activity.record',
          issueIdentifier: key,
          body: `GitHub review ${action || asString(asRecord(body.review).state) || 'updated'}`,
        })
      }
    }
    return commands
  }
  if (eventType === 'push') {
    const commits = Array.isArray(body.commits) ? body.commits : []
    const commands: IntegrationCommand[] = []
    for (const commit of commits) {
      const row = asRecord(commit)
      const message = asString(row.message)
      const url = asString(row.url)
      for (const key of parseIssueKeys(message)) {
        commands.push({
          type: 'external.link',
          issueIdentifier: key,
          url,
          title: message.split('\n')[0] || 'Commit',
          externalId: asString(row.id) || asString(row.sha),
          metadata: { kind: 'commit' },
        })
      }
    }
    return commands
  }
  return []
}
