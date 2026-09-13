import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { groupIssues, type IssueGroup } from '../lib/filters'
import type { DisplayProperty, Issue } from '../lib/types'
import { LIST_ROW_HEIGHT, visibleRange } from '../lib/virtualize'
import { ContextMenu } from '../ui/overlays'
import { PriorityIcon, StatusIcon } from './icons'
import { Avatar } from './picker'

export function IssueList({
  issues,
  view,
}: {
  issues: Issue[]
  view: string
}) {
  const store = useNock()
  const scroller = useRef<HTMLDivElement>(null)
  const restoring = useRef(false)
  const groups = groupIssues(
    issues,
    view === 'inbox' ? 'status' : store.ui.groupBy,
    {
      states: [...store.states.values()],
      users: [...store.users.values()],
      projects: [...store.projects.values()],
      cycles: [...store.cycles.values()],
    },
  )
  const rows = useMemo(() => flatten(groups, store.ui.collapsedStateIds), [groups, store.ui.collapsedStateIds])
  const highlighted = store.ui.highlightedIssueId

  useLayoutEffect(() => {
    const node = scroller.current
    const top = store.ui.pendingListScroll ?? store.ui.collectionRestore?.scrollTop
    if (!node || top == null || store.ui.peekOpen) return
    restoring.current = true
    node.scrollTop = top
    store.ui.listScrollTop = node.scrollTop
    store.ui.pendingListScroll = null
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-testid^="issue-row-"][data-highlighted]')
        ?.focus()
      restoring.current = false
    })
  }, [store, store.ui.pendingListScroll, store.ui.collectionRestore, store.ui.peekOpen])

  useEffect(() => {
    const node = scroller.current
    if (!node || !highlighted || store.ui.pendingListScroll != null) return
    if (store.ui.collectionRestore || restoring.current) return
    const visible = node.querySelector<HTMLElement>(
      '[data-testid^="issue-row-"][data-highlighted]',
    )
    if (visible) {
      const parent = node.getBoundingClientRect()
      const box = visible.getBoundingClientRect()
      if (box.top >= parent.top - 4 && box.bottom <= parent.bottom + 4) return
    }
    const index = rows.findIndex((row) => row.type === 'issue' && row.id === highlighted)
    if (index < 0) return
    const top = index * LIST_ROW_HEIGHT
    if (top < node.scrollTop) node.scrollTop = top
    if (top + LIST_ROW_HEIGHT > node.scrollTop + node.clientHeight) {
      node.scrollTop = top - node.clientHeight + LIST_ROW_HEIGHT
    }
  }, [highlighted, rows, store.ui.collectionRestore, store.ui.pendingListScroll])

  if (issues.length === 0) return null

  const range = visibleRange(
    rows.length,
    scroller.current?.scrollTop ?? 0,
    scroller.current?.clientHeight ?? 720,
    LIST_ROW_HEIGHT,
  )

  return (
    <div
      ref={scroller}
      data-testid="issue-list"
      role="listbox"
      aria-label="Issues"
      aria-multiselectable="true"
      className="min-h-0 flex-1 overflow-auto"
      onScroll={() => {
        if (restoring.current) return
        store.ui.listScrollTop = scroller.current?.scrollTop ?? 0
        store.bump()
      }}
    >
      <div style={{ height: range.height, position: 'relative' }}>
        <div style={{ transform: `translateY(${range.offset}px)` }}>
          {rows.slice(range.start, range.end).map((row) =>
            row.type === 'header' ? (
              <GroupHeader key={row.key} group={row} />
            ) : (
              <IssueRow key={row.id} issueId={row.id} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

type FlatRow =
  | { type: 'header'; key: string; label: string; count: number; stateId?: string }
  | { type: 'issue'; id: string }

function flatten(groups: IssueGroup[], collapsed: string[]): FlatRow[] {
  const rows: FlatRow[] = []
  for (const group of groups) {
    rows.push({
      type: 'header',
      key: group.key,
      label: group.label,
      count: group.issues.length,
      stateId: group.state?.id,
    })
    if (collapsed.includes(group.key)) continue
    for (const issue of group.issues) rows.push({ type: 'issue', id: issue.id })
  }
  return rows
}

function GroupHeader({ group }: { group: Extract<FlatRow, { type: 'header' }> }) {
  const store = useNock()
  const state = group.stateId ? store.states.get(group.stateId) : undefined
  return (
    <div role="presentation" style={{ height: LIST_ROW_HEIGHT }}>
      <button
        type="button"
        tabIndex={-1}
        data-testid={`group-header-${group.key}`}
        aria-label={`${group.label}, ${group.count} issues`}
        className="sticky top-0 z-10 flex h-full w-full items-center gap-2 border-b border-line/80 bg-fill/95 px-4 text-[12px] text-mute backdrop-blur"
        onClick={() => store.toggleCollapsed(group.key)}
      >
        {state && <StatusIcon state={state} />}
        <span className="font-medium text-ink">{group.label}</span>
        <span className="text-dim">{group.count}</span>
      </button>
    </div>
  )
}

export function IssueRow({ issueId }: { issueId: string }) {
  const store = useNock()
  const issue = store.issue(issueId)
  if (!issue) return null
  const state = store.states.get(issue.stateId)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const project = issue.projectId ? store.projects.get(issue.projectId) : undefined
  const cycle = issue.cycleId ? store.cycles.get(issue.cycleId) : undefined
  const labels = issue.labelIds
    .map((id) => store.labels.get(id))
    .filter((label) => label !== undefined)
  const highlighted = store.ui.highlightedIssueId === issue.id
  const selected = store.ui.selectedIssueIds.includes(issue.id)
  const show = (property: DisplayProperty) => store.ui.displayProperties.includes(property)
  const subscribed = issue.subscriberIds.includes(store.currentUserId)
  const completed = state?.type === 'completed' || state?.type === 'canceled'
  const archived = Boolean(issue.archivedAt)
  const syncStatus = store.sync.statusForIssue(issue.id)
  const optimistic = syncStatus === 'queued' || syncStatus === 'sending'

  return (
    <div className="w-full" style={{ height: LIST_ROW_HEIGHT }}>
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
          data-testid={`issue-row-${issue.identifier}`}
          data-highlighted={highlighted || undefined}
          data-selected={selected || undefined}
          role="option"
          aria-selected={selected}
          tabIndex={highlighted ? 0 : -1}
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
          onDoubleClick={() => store.commands.run('issue.open', { id: issue.id })}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.code === 'Space') event.preventDefault()
            if (event.key === 'Enter') store.commands.run('issue.open', { id: issue.id })
          }}
          className={cn(
            'flex h-[34px] w-full items-center gap-3 border-b border-line/70 px-4 text-left outline-none',
            'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-accent/50',
            highlighted && 'bg-hover',
            selected && 'bg-accent/10',
            (completed || archived) && 'opacity-60',
          )}
        >
          <span
            className={cn(
              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
              selected ? 'border-accent bg-accent' : 'border-dim/80',
            )}
          />
          {show('status') && state && <StatusIcon state={state} />}
          {show('id') && (
            <span className="w-14 shrink-0 text-[12px] tabular-nums text-mute">
              {issue.identifier}
            </span>
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[13px] leading-[34px]',
              (completed || archived) && 'line-through text-mute',
            )}
          >
            {issue.title}
          </span>
          {optimistic && (
            <span
              data-testid="optimistic-dot"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              title={syncStatus ?? 'queued'}
            />
          )}
          {syncStatus === 'failed' && (
            <span className="text-[11px] text-danger">Failed</span>
          )}
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
          {show('priority') && <PriorityIcon priority={issue.priority} />}
          {show('assignee') &&
            (assignee ? <Avatar user={assignee} /> : <span className="w-[18px]" />)}
        </button>
      </ContextMenu>
    </div>
  )
}
