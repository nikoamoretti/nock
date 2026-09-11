import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn, formatShortDate } from '../lib/cn'
import { groupByState } from '../lib/filters'
import type { Issue, ViewId } from '../lib/types'
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
  const issues = store.issuesForView(view)
  const groups = groupByState(issues, [...store.states.values()])
  const selected = store.selectedIssue()

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4"
        >
          <div className="text-[13px] font-medium">{TITLES[view]}</div>
          <div className="flex items-center gap-1">
            {view !== 'inbox' && view !== 'my-issues' && (
              <>
                <ViewSwitch to="/eng/all" active={view !== 'board'} label="List" />
                <ViewSwitch to="/eng/board" active={view === 'board'} label="Board" />
              </>
            )}
            <button
              type="button"
              className="ml-2 rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-white"
              onClick={() => store.openComposer(view)}
            >
              New issue
            </button>
          </div>
        </header>
        {view === 'board' ? (
          <Board issues={issues} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {issues.length === 0 ? (
              <Empty view={view} />
            ) : (
              groups.map((group) => {
                const collapsed = store.ui.collapsedStateIds.includes(group.state.id)
                return (
                  <section key={group.state.id}>
                    <button
                      type="button"
                      className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-line bg-fill/95 px-4 py-1.5 text-[12px] text-mute backdrop-blur"
                      onClick={() => store.toggleCollapsed(group.state.id)}
                    >
                      <StatusIcon state={group.state} />
                      <span className="font-medium text-ink">{group.state.name}</span>
                      <span className="text-dim">{group.issues.length}</span>
                    </button>
                    {!collapsed &&
                      group.issues.map((issue) => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          selected={selected?.id === issue.id}
                        />
                      ))}
                  </section>
                )
              })
            )}
          </div>
        )}
      </div>
      {selected && <IssuePeek />}
    </div>
  )
}

function ViewSwitch({
  to,
  active,
  label,
}: {
  to: string
  active: boolean
  label: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
    >
      {label}
    </Link>
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

export function IssueRow({
  issue,
  selected,
}: {
  issue: Issue
  selected: boolean
}) {
  const store = useNock()
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined
  const labels = issue.labelIds
    .map((id) => store.labels.get(id))
    .filter((label) => label !== undefined)

  return (
    <button
      type="button"
      onClick={() => store.selectIssue(issue.id)}
      className={cn(
        'flex w-full items-center gap-3 border-b border-line px-4 py-[7px] text-left hover:bg-hover',
        selected && 'bg-hover',
      )}
    >
      <PriorityIcon priority={issue.priority} />
      <span className="w-14 shrink-0 text-[12px] tabular-nums text-mute">
        {issue.identifier}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{issue.title}</span>
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
      {cycle && (
        <span className="hidden text-[12px] text-dim lg:inline">
          Cycle {cycle.number}
        </span>
      )}
      {project && (
        <span className="hidden max-w-[140px] truncate text-[12px] text-dim xl:inline">
          {project.name}
        </span>
      )}
      {assignee ? <Avatar user={assignee} /> : <span className="w-[18px]" />}
      {state && <StatusIcon state={state} />}
    </button>
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
              if (id) store.updateIssue(id, { stateId: state.id })
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
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/nock-issue', issue.id)
      }}
      onClick={() => store.selectIssue(issue.id)}
      className={cn(
        'w-full cursor-grab rounded-md border border-line bg-lift px-3 py-2 text-left hover:border-accent/50',
        store.ui.selectedIssueId === issue.id && 'ring-1 ring-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] leading-5">{issue.title}</div>
        <PriorityIcon priority={issue.priority} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-mute">{issue.identifier}</span>
        {assignee && <Avatar user={assignee} />}
      </div>
    </button>
  )
}

export function IssuePeek() {
  const store = useNock()
  const issue = store.selectedIssue()
  if (!issue) return null
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-fill">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="text-[12px] text-mute">{issue.identifier}</span>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
          onClick={() => store.selectIssue(null)}
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <input
          value={issue.title}
          onChange={(event) =>
            store.updateIssue(issue.id, { title: event.target.value })
          }
          className="w-full bg-transparent text-[18px] font-medium outline-none"
        />
        <textarea
          value={issue.description}
          onChange={(event) =>
            store.updateIssue(issue.id, { description: event.target.value })
          }
          placeholder="Add description…"
          rows={8}
          className="mt-3 w-full resize-y bg-transparent text-[13px] leading-6 text-ink outline-none placeholder:text-dim"
        />
        <dl className="mt-6 space-y-2 text-[13px]">
          <PeekRow
            label="Status"
            onClick={() => store.openPropertyMenu('status')}
          >
            {state && <StatusIcon state={state} />}
            {state?.name}
          </PeekRow>
          <PeekRow
            label="Assignee"
            onClick={() => store.openPropertyMenu('assignee')}
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
            onClick={() => store.openPropertyMenu('priority')}
          >
            <PriorityIcon priority={issue.priority} />
          </PeekRow>
          <PeekRow
            label="Project"
            onClick={() => store.openPropertyMenu('project')}
          >
            {project?.name ?? <span className="text-dim">None</span>}
          </PeekRow>
          <PeekRow
            label="Cycle"
            onClick={() => store.openPropertyMenu('cycle')}
          >
            {cycle ? `Cycle ${cycle.number}` : <span className="text-dim">None</span>}
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
