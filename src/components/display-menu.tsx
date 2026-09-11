import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import {
  DEFAULT_DISPLAY_PROPERTIES,
  type DisplayProperty,
  type GroupBy,
} from '../lib/types'

const GROUPS: Array<{ id: GroupBy; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'project', label: 'Project' },
  { id: 'none', label: 'No grouping' },
]

const PROPERTY_LABELS: Record<DisplayProperty, string> = {
  id: 'ID',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  project: 'Project',
  cycle: 'Cycle',
  labels: 'Labels',
}

export function DisplayMenu() {
  const store = useNock()
  if (!store.ui.displayMenuOpen) return null

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.toggleDisplayMenu()}>
      <div
        className="absolute right-4 top-12 w-[260px] overflow-hidden rounded-lg border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] text-mute">
          Display options
        </div>
        <div className="p-2">
          <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-dim">
            Grouping
          </div>
          {GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className={cn(
                'flex w-full rounded-md px-2 py-1.5 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
                store.ui.groupBy === group.id && 'bg-hover text-ink',
              )}
              onClick={() => store.setGroupBy(group.id)}
            >
              {group.label}
            </button>
          ))}
          <div className="mt-2 px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-dim">
            Properties
          </div>
          {DEFAULT_DISPLAY_PROPERTIES.map((property) => {
            const on = store.ui.displayProperties.includes(property)
            return (
              <button
                key={property}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
                  on && 'text-ink',
                )}
                onClick={() => store.toggleDisplayProperty(property)}
              >
                {PROPERTY_LABELS[property]}
                <span className="text-[11px] text-dim">{on ? 'On' : 'Off'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
