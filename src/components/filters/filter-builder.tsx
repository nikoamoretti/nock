import type { ReactNode } from 'react'
import { useNock } from '../../hooks/use-nock'
import { cn } from '../../lib/cn'
import { combineFilterRoot } from '../../lib/filter-ast'
import { filtersActive } from '../../lib/filters'
import { FILTER_UNASSIGNED, PRIORITY_LABELS, type Priority } from '../../lib/types'

export function FilterBuilder({ onClose }: { onClose: () => void }) {
  const store = useNock()
  const filters = store.ui.filters
  const ast = store.ui.filterAst
  const combine = ast.type === 'or' ? 'or' : 'and'

  return (
    <div
      className="absolute left-[248px] top-12 flex max-h-[min(70vh,calc(100vh-4.5rem))] w-[280px] flex-col overflow-hidden rounded-lg border border-line bg-lift shadow-2xl"
      data-testid="filter-menu"
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
      <div className="flex gap-1 border-b border-line px-2 py-2">
        <CombineButton
          active={combine === 'and'}
          testId="filter-combine-and"
          onClick={() => store.setFilterAst(combineFilterRoot(ast, 'and'))}
        >
          All
        </CombineButton>
        <CombineButton
          active={combine === 'or'}
          testId="filter-combine-or"
          onClick={() => store.setFilterAst(combineFilterRoot(ast, 'or'))}
        >
          Any
        </CombineButton>
        <button
          type="button"
          className="ml-auto rounded-md px-2 py-0.5 text-[11px] text-dim hover:text-ink"
          onClick={onClose}
        >
          Done
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <Field label="Assignee">
          <Option
            active={filters.assigneeId === null}
            testId="filter-assignee-any"
            onClick={() => store.setFilter('assigneeId', null)}
          >
            Any
          </Option>
          <Option
            active={filters.assigneeId === FILTER_UNASSIGNED}
            testId="filter-assignee-none"
            onClick={() => store.setFilter('assigneeId', FILTER_UNASSIGNED)}
          >
            Unassigned
          </Option>
          {[...store.users.values()].map((user) => (
            <Option
              key={user.id}
              active={filters.assigneeId === user.id}
              testId={`filter-assignee-${user.id}`}
              onClick={() => store.setFilter('assigneeId', user.id)}
            >
              {user.name}
            </Option>
          ))}
        </Field>
        <Field label="Status">
          <Option
            active={filters.stateId === null}
            testId="filter-status-any"
            onClick={() => store.setFilter('stateId', null)}
          >
            Any
          </Option>
          {store.statesForTeam(store.defaultTeam().id).map((state) => (
            <Option
              key={state.id}
              active={filters.stateId === state.id}
              testId={`filter-status-${state.id}`}
              onClick={() => store.setFilter('stateId', state.id)}
            >
              {state.name}
            </Option>
          ))}
        </Field>
        <Field label="Priority">
          <Option
            active={filters.priority === null}
            testId="filter-priority-any"
            onClick={() => store.setFilter('priority', null)}
          >
            Any
          </Option>
          {([0, 1, 2, 3, 4] as Priority[]).map((priority) => (
            <Option
              key={priority}
              active={filters.priority === priority}
              testId={`filter-priority-${priority}`}
              onClick={() => store.setFilter('priority', priority)}
            >
              {PRIORITY_LABELS[priority]}
            </Option>
          ))}
        </Field>
        <Field label="Label">
          <Option
            active={!hasClauseField(ast, 'labelId')}
            onClick={() => store.setFilterAst(removeField(ast, 'labelId'))}
          >
            Any
          </Option>
          {[...store.labels.values()].map((label) => (
            <Option
              key={label.id}
              active={hasClause(ast, 'labelId', label.id)}
              onClick={() => store.setFilterAst(toggleClause(ast, 'labelId', label.id, combine))}
            >
              {label.name}
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
  )
}

function hasClauseField(
  ast: import('../../lib/types').FilterAst,
  field: 'labelId',
): boolean {
  if (ast.type === 'all') return false
  if (ast.type === 'clause') return ast.clause.field === field
  return ast.nodes.some((node) => hasClauseField(node, field))
}

function hasClause(
  ast: import('../../lib/types').FilterAst,
  field: 'labelId',
  value: string,
): boolean {
  if (ast.type === 'all') return false
  if (ast.type === 'clause') return ast.clause.field === field && ast.clause.value === value
  return ast.nodes.some((node) => hasClause(node, field, value))
}

function removeField(
  ast: import('../../lib/types').FilterAst,
  field: 'labelId',
): import('../../lib/types').FilterAst {
  if (ast.type === 'all') return ast
  if (ast.type === 'clause') return ast.clause.field === field ? { type: 'all' } : ast
  const nodes = ast.nodes
    .map((node) => removeField(node, field))
    .filter((node) => node.type !== 'all')
  if (nodes.length === 0) return { type: 'all' }
  if (nodes.length === 1) return nodes[0]
  return { type: ast.type, nodes }
}

function toggleClause(
  ast: import('../../lib/types').FilterAst,
  field: 'labelId',
  value: string,
  combine: 'and' | 'or',
): import('../../lib/types').FilterAst {
  if (hasClause(ast, field, value)) return removeField(ast, field)
  const clause = { type: 'clause' as const, clause: { field, op: 'eq' as const, value } }
  if (ast.type === 'all') return clause
  if (ast.type === 'clause') return { type: combine, nodes: [ast, clause] }
  return { type: ast.type, nodes: [...ast.nodes, clause] }
}

function CombineButton({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  testId: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={cn(
        'rounded-md px-2 py-0.5 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
      onClick={onClick}
    >
      {children}
    </button>
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
  testId,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
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
