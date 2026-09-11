import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn, formatShortDate } from '../lib/cn'
import { filtersActive, groupIssues } from '../lib/filters'
import type { DisplayProperty, Issue, ViewId } from '../lib/types'
import { filtersFromSearch, searchFromFilters } from '../lib/url-filters'
import { ContextMenu } from '../ui/overlays'
import { BulkBar } from './bulk-bar'
import { DisplayMenu } from './display-menu'
import { FilterMenu } from './filter-menu'
import { PriorityIcon, StatusIcon } from './icons'
import { Avatar } from './property-menu'

const TITLES: Record<ViewId, string> = {
  inbox: 'Inbox',
  'my-issues': 'My issues',
  all: 'All issues',
  active: 'Active',
  backlog: 'Backlog',
  board: 'Board',
  projects: 'Projects',
  cycles: 'Cycles',
}

export function IssueView({ view }: { view: ViewId }) {
  const store = useNock()
  const location = useLocation()
  const navigate = useNavigate()
  const storeSearch = searchFromFilters(store.ui.filters)

  useEffect(() => {
    store.setFilters(filtersFromSearch(location.search))
  }, [location.search, store])

  useEffect(() => {
    const current = searchFromFilters(filtersFromSearch(location.search))
    if (current !== storeSearch) {
      navigate(
        { pathname: location.pathname, search: storeSearch },
        { replace: true },
      )
    }
  }, [location.pathname, location.search, navigate, storeSearch])

  const issueIds = store.issueIdsForView(view)
  const issues = issueIds
    .map((id) => store.issue(id))
    .filter((issue): issue is Issue => Boolean(issue))
  const layout = store.effectiveLayout(view)
  const groups = groupIssues(
    issues,
    view === 'inbox' || layout === 'board' ? 'status' : store.ui.groupBy,
    {
    states: [...store.states.values()],
    users: [...store.users.values()],
    projects: [...store.projects.values()],
  })
  const peeked = store.peekedIssue()
  const filterOn = filtersActive(store.ui.filters)

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4"
        >
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-medium">{TITLES[view]}</div>
            <span className="text-[12px] text-dim">{issues.length}</span>
          </div>
          <div className="flex items-center gap-1">
            {view === 'inbox' && (
              <>
                <HeaderButton
                  label="Accept"
                  hint="1"
                  onClick={() => store.commands.run('issue.acceptTriage')}
                />
                <HeaderButton
                  label="Decline"
                  hint="3"
                  onClick={() => store.commands.run('issue.declineTriage')}
                />
              </>
            )}
            <HeaderButton
              label="Filter"
              hint="F"
              active={filterOn || store.ui.filterMenuOpen}
              onClick={() => store.commands.run('view.openFilters')}
            />
            <HeaderButton
              label="Display"
              hint="⇧V"
              active={store.ui.displayMenuOpen}
              onClick={() => store.commands.run('view.openDisplayOptions')}
            />
            {view !== 'inbox' && (
              <>
                <ViewSwitch
                  active={layout === 'list'}
                  label="List"
                  onClick={() => {
                    if (layout === 'board') store.commands.run('view.toggleLayout')
                    else store.setLayout('list')
                  }}
                />
                <ViewSwitch
                  active={layout === 'board'}
                  label="Board"
                  onClick={() => store.setLayout('board')}
                />
              </>
            )}
            <button
              type="button"
              className="ml-2 rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-white"
              onClick={() => store.commands.run('issue.create')}
            >
              New issue
            </button>
          </div>
        </header>
        {layout === 'board' ? (
          <Board issues={issues} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {issues.length === 0 ? (
              <Empty view={view} />
            ) : (
              groups.map((group) => {
                const collapsed = store.ui.collapsedStateIds.includes(group.key)
                return (
                  <section key={group.key}>
                    <button
                      type="button"
                      className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-line bg-fill/95 px-4 py-1.5 text-[12px] text-mute backdrop-blur"
                      onClick={() => store.toggleCollapsed(group.key)}
                    >
                      {group.state && <StatusIcon state={group.state} />}
                      <span className="font-medium text-ink">{group.label}</span>
                      <span className="text-dim">{group.issues.length}</span>
                    </button>
                    {!collapsed &&
                      group.issues.map((issue) => (
                        <IssueRow key={issue.id} issue={issue} />
                      ))}
                  </section>
                )
              })
            )}
          </div>
        )}
        <BulkBar />
      </div>
      {peeked && <IssuePeek />}
      <FilterMenu />
      <DisplayMenu />
    </div>
  )
}

function HeaderButton({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
    >
      {label}
      <span className="ml-1 text-[10px] text-dim">{hint}</span>
    </button>
  )
}

function ViewSwitch({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
    >
      {label}
    </button>
  )
}

function Empty({ view }: { view: ViewId }) {
  const copy =
    view === 'inbox'
      ? 'Triage is clear'
      : view === 'my-issues'
        ? 'Nothing assigned to you'
        : 'No issues in this view'
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-mute">
      {copy}
    </div>
  )
}

export function IssueRow({ issue }: { issue: Issue }) {
  const store = useNock()
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined
  const labels = issue.labelIds
    .map((id) => store.labels.get(id))
    .filter((label) => label !== undefined)
  const highlighted = store.ui.highlightedIssueId === issue.id
  const selected = store.ui.selectedIssueIds.includes(issue.id)
  const show = (property: DisplayProperty) =>
    store.ui.displayProperties.includes(property)
  const subscribed = issue.subscriberIds.includes(store.currentUserId)

  return (
    <div className="w-full">
    <ContextMenu
      items={[
        {
          id: 'open',
          label: 'Open',
          onSelect: () => store.commands.run('issue.open', { id: issue.id }),
        },
        {
          id: 'status',
          label: 'Set status',
          onSelect: () => store.commands.run('issue.setStatus'),
        },
        {
          id: 'priority',
          label: 'Set priority',
          onSelect: () => store.commands.run('issue.setPriority'),
        },
        {
          id: 'assignee',
          label: 'Set assignee',
          onSelect: () => store.commands.run('issue.setAssignee'),
        },
        {
          id: 'label',
          label: 'Add label',
          onSelect: () => store.commands.run('issue.addLabel'),
        },
        {
          id: 'project',
          label: 'Set project',
          onSelect: () => store.commands.run('issue.setProject'),
        },
        {
          id: 'subscribe',
          label: subscribed ? 'Unsubscribe' : 'Subscribe',
          onSelect: () =>
            store.commands.run(subscribed ? 'issue.unsubscribe' : 'issue.subscribe'),
        },
        {
          id: 'archive',
          label: 'Archive',
          disabled: !store.commands.canRun('issue.archive'),
          onSelect: () => store.commands.run('issue.archive'),
        },
        {
          id: 'delete',
          label: 'Delete',
          onSelect: () => store.commands.run('issue.delete'),
        },
      ]}
    >
    <button
      type="button"
      onContextMenu={() => {
        if (!store.ui.selectedIssueIds.includes(issue.id)) {
          store.commands.run('selection.toggle', { id: issue.id, exclusive: true })
        }
      }}
      onClick={(event) => {
        if (event.shiftKey) {
          store.commands.run('selection.range', { id: issue.id })
          return
        }
        if (event.metaKey || event.ctrlKey) {
          store.commands.run('selection.toggle', { id: issue.id })
          return
        }
        store.commands.run('selection.toggle', { id: issue.id, exclusive: true })
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.code === 'Space') event.preventDefault()
      }}
      className={cn(
        'flex w-full items-center gap-3 border-b border-line px-4 py-[7px] text-left hover:bg-hover',
        highlighted && 'bg-hover',
        selected && 'bg-accent/10',
      )}
    >
      <span
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
          selected ? 'border-accent bg-accent' : 'border-dim/80',
        )}
      />
      {show('priority') && <PriorityIcon priority={issue.priority} />}
      {show('id') && (
        <span className="w-14 shrink-0 text-[12px] tabular-nums text-mute">
          {issue.identifier}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px]">{issue.title}</span>
      {show('labels') && (
        <span className="hidden items-center gap-1 md:flex">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[11px] text-mute"
              style={{ background: `${label.color}22`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </span>
      )}
      {show('cycle') && cycle && (
        <span className="hidden text-[12px] text-dim lg:inline">
          Cycle {cycle.number}
        </span>
      )}
      {show('project') && project && (
        <span className="hidden max-w-[140px] truncate text-[12px] text-dim xl:inline">
          {project.name}
        </span>
      )}
      {show('assignee') &&
        (assignee ? <Avatar user={assignee} /> : <span className="w-[18px]" />)}
      {show('status') && state && <StatusIcon state={state} />}
    </button>
    </ContextMenu>
    </div>
  )
}

function Board({ issues }: { issues: Issue[] }) {
  const store = useNock()
  const columns = store.boardStates()
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-auto p-3">
      {columns.map((state) => {
        const columnIssues = issues.filter((issue) => issue.stateId === state.id)
        return (
          <div
            key={state.id}
            className="flex w-[280px] shrink-0 flex-col rounded-lg border border-line bg-side"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/nock-issue')
              if (!id) return
              const issueIds =
                store.ui.selectedIssueIds.includes(id) &&
                store.ui.selectedIssueIds.length > 0
                  ? store.ui.selectedIssueIds
                  : [id]
              store.commands.run('issue.setStatus', { stateId: state.id, issueIds })
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-mute">
              <StatusIcon state={state} />
              <span className="font-medium text-ink">{state.name}</span>
              <span>{columnIssues.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {columnIssues.map((issue) => (
                <BoardCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoardCard({ issue }: { issue: Issue }) {
  const store = useNock()
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const highlighted = store.ui.highlightedIssueId === issue.id
  const selected = store.ui.selectedIssueIds.includes(issue.id)
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/nock-issue', issue.id)
      }}
      onClick={() =>
        store.commands.run('selection.toggle', { id: issue.id, exclusive: true })
      }
      onKeyDown={(event) => {
        if (event.key === ' ' || event.code === 'Space') event.preventDefault()
      }}
      className={cn(
        'w-full cursor-grab rounded-md border border-line bg-lift px-3 py-2 text-left hover:border-accent/50',
        highlighted && 'ring-1 ring-accent',
        selected && 'border-accent/70 bg-accent/10',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] leading-5">{issue.title}</div>
        {store.ui.displayProperties.includes('priority') && (
          <PriorityIcon priority={issue.priority} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {store.ui.displayProperties.includes('id') ? (
          <span className="text-[12px] text-mute">{issue.identifier}</span>
        ) : (
          <span />
        )}
        {store.ui.displayProperties.includes('assignee') && assignee && (
          <Avatar user={assignee} />
        )}
      </div>
    </button>
  )
}

export function IssuePeek() {
  const store = useNock()
  const issue = store.peekedIssue()
  if (!issue) return null
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined
  const triage = state?.type === 'triage'

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-fill">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="text-[12px] text-mute">{issue.identifier}</span>
        <div className="flex items-center gap-1">
          {triage && (
            <>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.acceptTriage')}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
                onClick={() => store.commands.run('issue.declineTriage')}
              >
                Decline
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
            onClick={() => store.togglePeek()}
          >
            Close
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <input
          value={issue.title}
          onChange={(event) =>
            store.execute({
              type: 'issue.update',
              id: issue.id,
              patch: { title: event.target.value },
            })
          }
          className="w-full bg-transparent text-[18px] font-medium outline-none"
        />
        <textarea
          value={issue.description}
          onChange={(event) =>
            store.execute({
              type: 'issue.update',
              id: issue.id,
              patch: { description: event.target.value },
            })
          }
          placeholder="Add description…"
          rows={8}
          className="mt-3 w-full resize-y bg-transparent text-[13px] leading-6 text-ink outline-none placeholder:text-dim"
        />
        <dl className="mt-6 space-y-2 text-[13px]">
          <PeekRow
            label="Status"
            onClick={() => store.commands.run('issue.setStatus')}
          >
            {state && <StatusIcon state={state} />}
            {state?.name}
          </PeekRow>
          <PeekRow
            label="Assignee"
            onClick={() => store.commands.run('issue.setAssignee')}
          >
            {assignee ? (
              <>
                <Avatar user={assignee} /> {assignee.name}
              </>
            ) : (
              <span className="text-dim">Unassigned</span>
            )}
          </PeekRow>
          <PeekRow
            label="Priority"
            onClick={() => store.commands.run('issue.setPriority')}
          >
            <PriorityIcon priority={issue.priority} />
          </PeekRow>
          <PeekRow
            label="Project"
            onClick={() => store.commands.run('issue.setProject')}
          >
            {project?.name ?? <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow
            label="Cycle"
            onClick={() => store.commands.run('issue.setCycle')}
          >
            {cycle ? `Cycle ${cycle.number}` : <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow
            label="Labels"
            onClick={() => store.commands.run('issue.addLabel')}
          >
            {issue.labelIds.length
              ? `${issue.labelIds.length}`
              : <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow
            label="Milestone"
            onClick={() => store.commands.run('issue.setMilestone')}
          >
            {issue.milestoneId
              ? (store.milestones.get(issue.milestoneId)?.name ?? 'Milestone')
              : <span className="text-dim">None</span>}
          </PeekRow>
          <div className="flex items-center justify-between py-1 text-mute">
            <dt>Created</dt>
            <dd>{formatShortDate(issue.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}

function PeekRow({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mute">{label}</dt>
      <dd>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-hover"
        >
          {children}
        </button>
      </dd>
    </div>
  )
}
