import type { ReactNode } from 'react'
import { useNock } from '../../hooks/use-nock'
import { cn } from '../../lib/cn'
import { fieldIsMixed, filterAstActive, hasClause } from '../../lib/filter-ast'
import { FILTER_UNASSIGNED, PRIORITY_LABELS, type FilterField, type Priority } from '../../lib/types'

export function FilterBuilder({ onClose }: { onClose: () => void }) {
  const store = useNock()
  const ast = store.ui.filterAst
  const combine = store.ui.filterCombine
  const team = store.routeTeam()

  return (
    <div
      className="flex max-h-[min(70vh,calc(100vh-4.5rem))] w-[280px] flex-col overflow-hidden rounded-lg border border-line bg-lift shadow-2xl"
      data-testid="filter-menu"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[12px] text-mute">Filter issues</span>
        {filterAstActive(ast) && (
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
          onClick={() => store.setFilterCombine('and')}
        >
          All
        </CombineButton>
        <CombineButton
          active={combine === 'or'}
          testId="filter-combine-or"
          onClick={() => store.setFilterCombine('or')}
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
        <Field label="Assignee" mixed={fieldIsMixed(ast, 'assigneeId')}>
          <Option
            active={!hasClauseField(ast, 'assigneeId')}
            testId="filter-assignee-any"
            onClick={() => store.clearFilterField('assigneeId')}
          >
            Any
          </Option>
          <Option
            active={hasClause(ast, 'assigneeId', FILTER_UNASSIGNED)}
            testId="filter-assignee-none"
            onClick={() => store.setFilter('assigneeId', FILTER_UNASSIGNED)}
          >
            Unassigned
          </Option>
          {[...store.users.values()].map((user) => (
            <Option
              key={user.id}
              active={hasClause(ast, 'assigneeId', user.id)}
              testId={`filter-assignee-${user.id}`}
              onClick={() => store.setFilter('assigneeId', user.id)}
            >
              {user.name}
            </Option>
          ))}
        </Field>
        <Field label="Status" mixed={fieldIsMixed(ast, 'stateId')}>
          <Option
            active={!hasClauseField(ast, 'stateId')}
            testId="filter-status-any"
            onClick={() => store.clearFilterField('stateId')}
          >
            Any
          </Option>
          {store.statesForTeam(team.id).map((state) => (
            <Option
              key={state.id}
              active={hasClause(ast, 'stateId', state.id)}
              testId={`filter-status-${state.id}`}
              onClick={() => store.setFilter('stateId', state.id)}
            >
              {state.name}
            </Option>
          ))}
        </Field>
        <Field label="Priority" mixed={fieldIsMixed(ast, 'priority')}>
          <Option
            active={!hasClauseField(ast, 'priority')}
            testId="filter-priority-any"
            onClick={() => store.clearFilterField('priority')}
          >
            Any
          </Option>
          {([0, 1, 2, 3, 4] as Priority[]).map((priority) => (
            <Option
              key={priority}
              active={hasClause(ast, 'priority', priority)}
              testId={`filter-priority-${priority}`}
              onClick={() => store.setFilter('priority', priority)}
            >
              {PRIORITY_LABELS[priority]}
            </Option>
          ))}
        </Field>
        <Field label="Label" mixed={fieldIsMixed(ast, 'labelId')}>
          <Option
            active={!hasClauseField(ast, 'labelId')}
            onClick={() => store.clearFilterField('labelId')}
          >
            Any
          </Option>
          {[...store.labels.values()].map((label) => (
            <Option
              key={label.id}
              active={hasClause(ast, 'labelId', label.id)}
              testId={`filter-label-${label.id}`}
              onClick={() => store.toggleFilterValue('labelId', label.id)}
            >
              {label.name}
            </Option>
          ))}
        </Field>
        <Field label="Project" mixed={fieldIsMixed(ast, 'projectId')}>
          <Option
            active={!hasClauseField(ast, 'projectId')}
            onClick={() => store.clearFilterField('projectId')}
          >
            Any
          </Option>
          {[...store.projects.values()].map((project) => (
            <Option
              key={project.id}
              active={hasClause(ast, 'projectId', project.id)}
              onClick={() => store.setFilter('projectId', project.id)}
            >
              {project.name}
            </Option>
          ))}
        </Field>
        <Field label="Cycle" mixed={fieldIsMixed(ast, 'cycleId')}>
          <Option
            active={!hasClauseField(ast, 'cycleId')}
            onClick={() => store.clearFilterField('cycleId')}
          >
            Any
          </Option>
          {[...store.cycles.values()]
            .filter((cycle) => cycle.teamId === team.id)
            .map((cycle) => (
              <Option
                key={cycle.id}
                active={hasClause(ast, 'cycleId', cycle.id)}
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
  field: FilterField,
): boolean {
  if (ast.type === 'all') return false
  if (ast.type === 'clause') return ast.clause.field === field
  return ast.nodes.some((node) => hasClauseField(node, field))
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
  mixed,
  children,
}: {
  label: string
  mixed?: boolean
  children: ReactNode
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 pb-1 text-[11px] uppercase tracking-wide text-dim">
        <span>{label}</span>
        {mixed && <span className="normal-case text-accent">Multiple</span>}
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
