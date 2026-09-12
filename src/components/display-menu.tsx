import { useState } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { viewFromPath } from '../lib/view-from-path'
import { useLocation } from 'react-router-dom'
import {
  DEFAULT_DISPLAY_PROPERTIES,
  type DisplayProperty,
  type GroupBy,
  type OrderBy,
} from '../lib/types'

const GROUPS: Array<{ id: GroupBy; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'project', label: 'Project' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'none', label: 'No grouping' },
]

const ORDERS: Array<{ id: OrderBy; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'updated', label: 'Updated' },
  { id: 'created', label: 'Created' },
  { id: 'manual', label: 'Manual' },
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
  const location = useLocation()
  const [name, setName] = useState('')
  if (!store.ui.displayMenuOpen) return null
  const view = viewFromPath(location.pathname)

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.toggleDisplayMenu()}>
      <div
        data-testid="display-menu"
        className="absolute right-4 top-12 w-[280px] overflow-hidden rounded-lg border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] text-mute">
          Display options
        </div>
        <div className="max-h-[min(70vh,480px)] overflow-auto p-2">
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
            Swimlanes
          </div>
          {GROUPS.map((group) => (
            <button
              key={`sub-${group.id}`}
              type="button"
              className={cn(
                'flex w-full rounded-md px-2 py-1.5 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
                store.ui.subgroupBy === group.id && 'bg-hover text-ink',
              )}
              onClick={() => store.setSubgroupBy(group.id)}
            >
              {group.label}
            </button>
          ))}
          <div className="mt-2 px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-dim">
            Ordering
          </div>
          {ORDERS.map((order) => (
            <button
              key={order.id}
              type="button"
              className={cn(
                'flex w-full rounded-md px-2 py-1.5 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
                store.ui.orderBy === order.id && 'bg-hover text-ink',
              )}
              onClick={() => store.setOrderBy(order.id)}
            >
              {order.label}
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
          <div className="mt-2 border-t border-line px-2 pt-2">
            <div className="pb-1 text-[11px] uppercase tracking-wide text-dim">
              Saved views
            </div>
            <form
              className="flex gap-1"
              onSubmit={(event) => {
                event.preventDefault()
                store.saveView(name, view)
                setName('')
              }}
            >
              <input
                data-testid="save-view-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-[12px] outline-none"
              />
              <button
                type="submit"
                data-testid="save-view"
                className="rounded-md px-2 text-[12px] text-accent"
              >
                Save
              </button>
            </form>
            {[...store.savedViews.values()].map((saved) => (
              <button
                key={saved.id}
                type="button"
                data-testid={`saved-view-${saved.name}`}
                className={cn(
                  'mt-1 flex w-full rounded-md px-2 py-1.5 text-left text-[13px] text-mute hover:bg-hover',
                  store.ui.savedViewId === saved.id && 'bg-hover text-ink',
                )}
                onClick={() => store.applySavedView(saved.id)}
              >
                {saved.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}