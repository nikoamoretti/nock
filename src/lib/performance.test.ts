import { describe, expect, it } from 'vitest'
import { createBootstrapSnapshot, IDS } from './seed'
import { NockStore } from './store'
import { visibleRange } from './virtualize'
import { splitInbox, type InboxNotification, type NotificationType } from './inbox'

const TYPES: NotificationType[] = [
  'mention',
  'assignment',
  'comment',
  'subscription',
  'project_update',
  'review_request',
  'integration',
]

describe('performance', () => {
  it('virtualizes 10,000 rows without walking the whole list', () => {
    const start = performance.now()
    const range = visibleRange(10_000, 12_000, 640, 34, 8)
    expect(range.end - range.start).toBeLessThan(80)
    expect(range.height).toBe(10_000 * 34)
    expect(performance.now() - start).toBeLessThan(10)
  })

  it('filters 5,000 issues in under 80ms', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = Array.from({ length: 5000 }, (_, index) => ({
      id: `perf_${index}`,
      teamId: IDS.teamEng,
      number: index + 1,
      identifier: `ENG-${index + 1}`,
      title: `Perf ${index}`,
      description: '',
      priority: (index % 5) as 0 | 1 | 2 | 3 | 4,
      stateId: index % 20 === 0 ? IDS.stateTriage : IDS.stateTodo,
      assigneeId: index % 3 === 0 ? IDS.userMe : null,
      projectId: null,
      cycleId: null,
      labelIds: [],
      parentId: null,
      sortOrder: index,
      createdAt: 1,
      updatedAt: 1,
      syncId: index,
      revision: index,
      lastMutationId: null,
      milestoneId: null,
      subscriberIds: [],
      relatedIssueIds: [],
      blockedByIds: [],
      duplicateOfId: null,
      archivedAt: null,
    }))
    const store = NockStore.from(snapshot)
    const start = performance.now()
    const all = store.issuesForView('all')
    const inbox = store.issuesForView('inbox')
    const elapsed = performance.now() - start
    expect(all.length).toBeGreaterThan(4000)
    expect(inbox.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(80)
    console.info(`[nock][perf] issuesForView 5000=${elapsed.toFixed(2)}ms all=${all.length} inbox=${inbox.length}`)
  })

  it('scores 2,000 notifications in under 80ms', () => {
    const rows: InboxNotification[] = Array.from({ length: 2000 }, (_, index) => ({
      id: `n_${index}`,
      userId: IDS.userMe,
      type: TYPES[index % TYPES.length]!,
      title: 'n',
      body: 'b',
      sourceType: 'issue',
      sourceId: null,
      readAt: null,
      archivedAt: null,
      priorityScore: 0,
      priorityOverride: null,
      createdAt: index,
    }))
    const start = performance.now()
    const split = splitInbox(rows, IDS.userMe)
    const elapsed = performance.now() - start
    expect(split.priority.length + split.other.length).toBe(2000)
    expect(elapsed).toBeLessThan(80)
    console.info(`[nock][perf] splitInbox 2000=${elapsed.toFixed(2)}ms`)
  })
})
