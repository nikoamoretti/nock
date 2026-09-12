import type { Issue, IssueLink, Priority } from './types'
import type { IssuePatch } from './commands'

export type TriageField = 'team' | 'status' | 'assignee' | 'priority' | 'label' | 'project'

export type TriageCondition = {
  field: TriageField
  value: string | number | null
}

export type TriageAction = {
  field: TriageField
  value: string | number | null
}

export type TriageRule = {
  id: string
  name: string
  enabled: boolean
  conditions: TriageCondition[]
  actions: TriageAction[]
}

export type CustomerRequest = {
  id: string
  customerId: string
  issueId: string | null
  body: string
  createdAt: number
}

const DAY_MS = 86_400_000

export function snoozeUntil(now = Date.now(), days = 1): number {
  return now + days * DAY_MS
}

export function isSnoozed(until: number | undefined, now = Date.now()): boolean {
  return typeof until === 'number' && until > now
}

export function matchTriageRule(issue: Issue, rule: TriageRule): boolean {
  if (!rule.enabled) return false
  return rule.conditions.every((condition) => {
    switch (condition.field) {
      case 'team':
        return issue.teamId === condition.value
      case 'status':
        return issue.stateId === condition.value
      case 'assignee':
        return issue.assigneeId === condition.value
      case 'priority':
        return issue.priority === condition.value
      case 'label':
        return issue.labelIds.includes(String(condition.value))
      case 'project':
        return issue.projectId === condition.value
    }
  })
}

export function applyTriageRules(issue: Issue, rules: TriageRule[]): IssuePatch {
  const patch: IssuePatch = {}
  for (const rule of rules) {
    if (!matchTriageRule(issue, rule)) continue
    for (const action of rule.actions) {
      if (action.field === 'team') patch.teamId = String(action.value)
      if (action.field === 'status') patch.stateId = String(action.value)
      if (action.field === 'assignee')
        patch.assigneeId = action.value == null ? null : String(action.value)
      if (action.field === 'priority') patch.priority = Number(action.value) as Priority
      if (action.field === 'project')
        patch.projectId = action.value == null ? null : String(action.value)
      if (action.field === 'label') {
        const labelId = String(action.value)
        const ids = new Set(patch.labelIds ?? issue.labelIds)
        ids.add(labelId)
        patch.labelIds = [...ids]
      }
    }
  }
  return patch
}

export function mergeSupportLinks(input: {
  fromId: string
  intoId: string
  links: IssueLink[]
  requests: CustomerRequest[]
}): { links: IssueLink[]; requests: CustomerRequest[] } {
  return {
    links: input.links.map((link) =>
      link.issueId === input.fromId ? { ...link, issueId: input.intoId } : link,
    ),
    requests: input.requests.map((request) =>
      request.issueId === input.fromId ? { ...request, issueId: input.intoId } : request,
    ),
  }
}
