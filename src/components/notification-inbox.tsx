import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { NOTIFICATION_TYPES, type InboxNotification } from '../lib/inbox'
import { visibleRange } from '../lib/virtualize'
import { useState } from 'react'

const ROW = 44

export function NotificationInbox({ pane }: { pane: 'priority' | 'other' }) {
  const store = useNock()
  const rows = store.inboxNotifications(pane)
  const [scrollTop, setScrollTop] = useState(0)
  const range = visibleRange(rows.length, scrollTop, 640, ROW, 8)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notification-inbox">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <fieldset className="flex flex-wrap items-center gap-2 text-[11px] text-mute">
          <legend className="sr-only">Delivery preferences</legend>
          {NOTIFICATION_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={store.inboxDelivery[type]}
                onChange={(event) => store.setDeliveryPreference(type, event.target.checked)}
              />
              <span className="capitalize">{type.replace('_', ' ')}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink"
          onClick={() => store.markInboxRead()}
        >
          Mark all read
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="listbox"
        aria-label={`${pane} notifications`}
      >
        <div style={{ height: range.height }}>
          <div style={{ height: range.offset }} />
          {rows.slice(range.start, range.end).map((row) => (
            <NotificationRow key={row.id} row={row} />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationRow({ row }: { row: InboxNotification }) {
  const store = useNock()
  const highlighted = store.ui.highlightedNotificationId === row.id
  return (
    <div
      role="option"
      aria-selected={highlighted}
      className={cn(
        'flex items-center gap-3 border-b border-line px-4 text-[13px]',
        highlighted && 'bg-hover',
      )}
      style={{ height: ROW }}
      data-testid={`inbox-row-${row.id}`}
      data-highlighted={highlighted || undefined}
      onClick={() => store.highlightNotification(row.id)}
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left hover:text-accent"
        onClick={(event) => {
          event.stopPropagation()
          store.highlightNotification(row.id)
          store.commands.run('issue.open', { id: row.id })
        }}
      >
        <span className={row.readAt ? 'text-mute' : 'font-medium text-ink'}>{row.title}</span>
        <span className="ml-2 text-[12px] text-dim">{row.type.replace('_', ' ')}</span>
      </button>
      <button
        type="button"
        className="text-[12px] text-mute hover:text-ink"
        onClick={(event) => {
          event.stopPropagation()
          store.archiveInbox(row.id)
        }}
      >
        Archive
      </button>
    </div>
  )
}
