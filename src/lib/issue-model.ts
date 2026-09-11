import type { IssuePatch } from './commands'
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
    revision: issue.revision ?? issue.syncId ?? 0,
    lastMutationId: issue.lastMutationId ?? null,
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

export function pickInverse(issue: Issue, patch: IssuePatch): IssuePatch {
  const inverse: IssuePatch = {}
  for (const key of Object.keys(patch) as Array<keyof IssuePatch>) {
    const value = issue[key as keyof Issue]
    ;(inverse as Record<string, unknown>)[key as string] = Array.isArray(value)
      ? [...value]
      : value
  }
  return inverse
}

export function patchFieldKeys(patch: IssuePatch | Partial<Issue>): string[] {
  return Object.keys(patch).filter(
    (key) =>
      key !== 'id' &&
      key !== 'createdAt' &&
      key !== 'updatedAt' &&
      key !== 'syncId' &&
      key !== 'revision' &&
      key !== 'lastMutationId',
  )
}
