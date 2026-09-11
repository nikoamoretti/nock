import type { ReactNode } from 'react'
import { useNock } from '../hooks/use-nock'
import { filtersActive } from '../lib/filters'
import { FILTER_UNASSIGNED, PRIORITY_LABELS, type Priority } from '../lib/types'
import { cn } from '../lib/cn'

export function FilterMenu() {
  const store = useNock()
  if (!store.ui.filterMenuOpen) return null
  const filters = store.ui.filters

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.toggleFilterMenu()}>
      <div
        className="absolute left-[248px] top-12 flex max-h-[min(70vh,calc(100vh-4.5rem))] w-[280px] flex-col overflow-hidden rounded-lg border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-[12px] text-mute">Filter issues</span>
          {filtersActive(filters) && (
            <button
              type="button"
              className="text-[12px] text-accent hover:text-ink"
              onClick={() => store.clearFilters()}
            >
              Clear
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <Field label="Assignee">
            <Option
              active={filters.assigneeId === null}
              onClick={() => store.setFilter('assigneeId', null)}
            >
              Any
            </Option>
            <Option
              active={filters.assigneeId === FILTER_UNASSIGNED}
              onClick={() => store.setFilter('assigneeId', FILTER_UNASSIGNED)}
            >
              Unassigned
            </Option>
            {[...store.users.values()].map((user) => (
              <Option
                key={user.id}
                active={filters.assigneeId === user.id}
                onClick={() => store.setFilter('assigneeId', user.id)}
              >
                {user.name}
              </Option>
            ))}
          </Field>
          <Field label="Status">
            <Option
              active={filters.stateId === null}
              onClick={() => store.setFilter('stateId', null)}
            >
              Any
            </Option>
            {store.statesForTeam(store.defaultTeam().id).map((state) => (
              <Option
                key={state.id}
                active={filters.stateId === state.id}
                onClick={() => store.setFilter('stateId', state.id)}
              >
                {state.name}
              </Option>
            ))}
          </Field>
          <Field label="Priority">
            <Option
              active={filters.priority === null}
              onClick={() => store.setFilter('priority', null)}
            >
              Any
            </Option>
            {([0, 1, 2, 3, 4] as Priority[]).map((priority) => (
              <Option
                key={priority}
                active={filters.priority === priority}
                onClick={() => store.setFilter('priority', priority)}
              >
                {PRIORITY_LABELS[priority]}
              </Option>
            ))}
          </Field>
          <Field label="Project">
            <Option
              active={filters.projectId === null}
              onClick={() => store.setFilter('projectId', null)}
            >
              Any
            </Option>
            {[...store.projects.values()].map((project) => (
              <Option
                key={project.id}
                active={filters.projectId === project.id}
                onClick={() => store.setFilter('projectId', project.id)}
              >
                {project.name}
              </Option>
            ))}
          </Field>
          <Field label="Cycle">
            <Option
              active={filters.cycleId === null}
              onClick={() => store.setFilter('cycleId', null)}
            >
              Any
            </Option>
            {[...store.cycles.values()].map((cycle) => (
              <Option
                key={cycle.id}
                active={filters.cycleId === cycle.id}
                onClick={() => store.setFilter('cycleId', cycle.id)}
              >
                Cycle {cycle.number}
              </Option>
            ))}
          </Field>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-dim">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-2 py-0.5 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
