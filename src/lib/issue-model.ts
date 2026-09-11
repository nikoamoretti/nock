import type { Issue } from './types'

export function normalizeIssue(issue: Issue): Issue {
  return {
    ...issue,
    labelIds: [...(issue.labelIds ?? [])],
    subscriberIds: [...(issue.subscriberIds ?? [])],
    relatedIssueIds: [...(issue.relatedIssueIds ?? [])],
    blockedByIds: [...(issue.blockedByIds ?? [])],
    milestoneId: issue.milestoneId ?? null,
    archivedAt: issue.archivedAt ?? null,
    duplicateOfId: issue.duplicateOfId ?? null,
  }
}

export function cloneIssue(issue: Issue): Issue {
  return normalizeIssue(issue)
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

export function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id]
}

export function withoutId(ids: string[], id: string): string[] {
  return ids.filter((item) => item !== id)
}
