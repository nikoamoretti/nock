export type NotificationType =
  | 'mention'
  | 'assignment'
  | 'comment'
  | 'subscription'
  | 'project_update'
  | 'review_request'
  | 'integration'

export type InboxNotification = {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  sourceType: string | null
  sourceId: string | null
  readAt: number | null
  archivedAt: number | null
  priorityScore: number
  priorityOverride: number | null
  createdAt: number
}

export type InboxBucket = 'priority' | 'other'

const TYPE_SCORE: Record<NotificationType, number> = {
  mention: 80,
  review_request: 75,
  assignment: 70,
  comment: 45,
  subscription: 30,
  project_update: 25,
  integration: 15,
}

export const PRIORITY_THRESHOLD = 55

export function scoreNotification(row: InboxNotification): number {
  if (row.priorityOverride != null) return row.priorityOverride
  const unread = row.readAt ? 0 : 10
  return TYPE_SCORE[row.type] + unread
}

export function bucketNotification(row: InboxNotification): InboxBucket {
  return scoreNotification(row) >= PRIORITY_THRESHOLD ? 'priority' : 'other'
}

export function splitInbox(
  rows: InboxNotification[],
  userId: string,
): { priority: InboxNotification[]; other: InboxNotification[] } {
  const live = rows.filter((row) => row.userId === userId && !row.archivedAt)
  const scored = live
    .map((row) => ({ row, score: scoreNotification(row) }))
    .sort((a, b) => b.score - a.score || b.row.createdAt - a.row.createdAt)
  const priority: InboxNotification[] = []
  const other: InboxNotification[] = []
  for (const item of scored) {
    if (item.score >= PRIORITY_THRESHOLD) priority.push(item.row)
    else other.push(item.row)
  }
  return { priority, other }
}

export function markAllRead(
  rows: InboxNotification[],
  userId: string,
  now = Date.now(),
): InboxNotification[] {
  return rows.map((row) =>
    row.userId === userId && !row.readAt && !row.archivedAt ? { ...row, readAt: now } : row,
  )
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  'mention',
  'assignment',
  'comment',
  'subscription',
  'project_update',
  'review_request',
  'integration',
]

export type DeliveryPreferences = Record<NotificationType, boolean>

export function defaultDeliveryPreferences(): DeliveryPreferences {
  return {
    mention: true,
    assignment: true,
    comment: true,
    subscription: true,
    project_update: true,
    review_request: true,
    integration: true,
  }
}

export function seedInboxNotifications(userId: string, now: number): InboxNotification[] {
  const rows: Array<
    Pick<InboxNotification, 'type' | 'title' | 'body' | 'sourceType' | 'sourceId'>
  > = [
    {
      type: 'mention',
      title: 'Maya mentioned you',
      body: 'Can you take this inbound?',
      sourceType: 'issue',
      sourceId: 'issue_1',
    },
    {
      type: 'assignment',
      title: 'You were assigned',
      body: 'Inbound: sync stalls on second laptop',
      sourceType: 'issue',
      sourceId: 'issue_1',
    },
    {
      type: 'review_request',
      title: 'Review requested',
      body: 'Please review the peek panel',
      sourceType: 'issue',
      sourceId: 'issue_3',
    },
    {
      type: 'comment',
      title: 'New comment',
      body: 'Jules left a comment on the board cards issue',
      sourceType: 'issue',
      sourceId: 'issue_3',
    },
    {
      type: 'subscription',
      title: 'Subscribed',
      body: 'You are watching Local-first sync',
      sourceType: 'issue',
      sourceId: 'issue_2',
    },
    {
      type: 'project_update',
      title: 'Project update',
      body: 'Local-first sync is still on track',
      sourceType: 'project',
      sourceId: 'proj_sync',
    },
    {
      type: 'integration',
      title: 'Integration event',
      body: 'External webhook is waiting to be processed',
      sourceType: 'issue',
      sourceId: null,
    },
  ]
  return rows.map((row, index) => ({
    id: `notif_${index + 1}`,
    userId,
    ...row,
    readAt: index > 4 ? now - 1000 : null,
    archivedAt: null,
    priorityScore: 0,
    priorityOverride: null,
    createdAt: now - index * 60_000,
  }))
}
