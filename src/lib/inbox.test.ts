import { describe, expect, it } from 'vitest'
import { IDS } from './seed'
import {
  bucketNotification,
  markAllRead,
  splitInbox,
  type InboxNotification,
  type NotificationType,
} from './inbox'

const TYPES: NotificationType[] = [
  'mention',
  'assignment',
  'comment',
  'subscription',
  'project_update',
  'review_request',
  'integration',
]

function row(index: number, type: NotificationType): InboxNotification {
  return {
    id: `n_${index}`,
    userId: IDS.userMe,
    type,
    title: `${type} ${index}`,
    body: 'body',
    sourceType: 'issue',
    sourceId: `issue_${index}`,
    readAt: index % 7 === 0 ? Date.now() : null,
    archivedAt: null,
    priorityScore: 0,
    priorityOverride: index === 3 ? 99 : null,
    createdAt: Date.now() - index * 1000,
  }
}

describe('notification inbox', () => {
  it('splits 2,000 notifications into Priority and Other quickly', () => {
    const rows = Array.from({ length: 2000 }, (_, index) => row(index, TYPES[index % TYPES.length]!))
    const start = performance.now()
    const split = splitInbox(rows, IDS.userMe)
    const elapsed = performance.now() - start
    expect(split.priority.length + split.other.length).toBe(2000)
    expect(split.priority.length).toBeGreaterThan(0)
    expect(split.other.length).toBeGreaterThan(0)
    expect(bucketNotification(rows[3]!)).toBe('priority')
    expect(elapsed).toBeLessThan(80)
    const marked = markAllRead(rows, IDS.userMe, 1)
    expect(marked.filter((item) => item.readAt === 1).length).toBeGreaterThan(1000)
  })
})
