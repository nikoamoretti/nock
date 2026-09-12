import { useEffect, useRef } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { groupIssues } from '../lib/filters'
import type { Issue, WorkflowState } from '../lib/types'
import { BOARD_CARD_HEIGHT, BOARD_COLUMN_WIDTH, visibleRange } from '../lib/virtualize'
import { PriorityIcon, StatusIcon } from './icons'
import { Avatar } from './picker'

export function IssueBoard({ issues }: { issues: Issue[] }) {
  const store = useNock()
  const groupBy = store.ui.groupBy === 'none' ? 'status' : store.ui.groupBy
  const columns = groupIssues(issues, groupBy, {
    states: [...store.states.values()],
    users: [...store.users.values()],
    projects: [...store.projects.values()],
    cycles: [...store.cycles.values()],
  })

  return (
    <div
      data-testid="issue-board"
      role="list"
      aria-label="Board"
      className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3"
    >
      {columns.map((column) => (
        <BoardColumn
          key={column.key}
          columnKey={column.key}
          label={column.label}
          state={column.state}
          issues={column.issues}
        />
      ))}
    </div>
  )
}

function BoardColumn({
  columnKey,
  label,
  state,
  issues,
}: {
  columnKey: string
  label: string
  state?: WorkflowState
  issues: Issue[]
}) {
  const store = useNock()
  const scroller = useRef<HTMLDivElement>(null)
  const dropStateId = state?.id ?? columnKey
  const drag = store.ui.drag
  const over = drag?.overStateId === dropStateId
  const lanes =
    store.ui.subgroupBy === 'none'
      ? [{ key: 'all', label: '', issues }]
      : groupIssues(issues, store.ui.subgroupBy, {
          states: [...store.states.values()],
          users: [...store.users.values()],
          projects: [...store.projects.values()],
          cycles: [...store.cycles.values()],
        })
  const virtualize = store.ui.subgroupBy === 'none'
  const range = visibleRange(
    issues.length,
    scroller.current?.scrollTop ?? 0,
    scroller.current?.clientHeight ?? 640,
    BOARD_CARD_HEIGHT + 8,
    4,
  )
  const visibleIssues = virtualize ? issues.slice(range.start, range.end) : issues

  function indexFromPoint(clientY: number): number {
    const node = scroller.current
    if (!node) return issues.length
    const rect = node.getBoundingClientRect()
    const y = clientY - rect.top + node.scrollTop
    return Math.max(0, Math.min(issues.length, Math.floor(y / (BOARD_CARD_HEIGHT + 8))))
  }

  function hover(clientY: number): void {
    if (!store.ui.drag || !state) return
    store.setDrag({
      ...store.ui.drag,
      overStateId: state.id,
      overIndex: indexFromPoint(clientY),
    })
  }

  function drop(): void {
    if (!store.ui.drag || !state) return
    const index = store.ui.drag.overIndex ?? issues.length
    store.dropIssuesOnColumn(state.id, store.ui.drag.issueIds, index)
  }

  return (
    <div
      data-testid={`board-column-${dropStateId}`}
      data-column-id={dropStateId}
      className="flex shrink-0 flex-col rounded-lg border border-line bg-side"
      style={{ width: BOARD_COLUMN_WIDTH }}
      onDragOver={(event) => {
        if (!state) return
        event.preventDefault()
        hover(event.clientY)
      }}
      onDrop={(event) => {
        if (!state) return
        event.preventDefault()
        drop()
      }}
      onPointerUp={() => {
        if (!store.ui.drag || !state) return
        drop()
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-mute">
        {state && <StatusIcon state={state} />}
        <span className="font-medium text-ink">{label}</span>
        <span>{issues.length}</span>
      </div>
      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col overflow-auto p-2"
        onScroll={() => store.bump()}
        onPointerMove={(event) => hover(event.clientY)}
      >
        {over && (
          <div
            data-testid="drop-placeholder"
            className="mb-2 rounded-md border border-dashed border-accent/70 bg-accent/10"
            style={{ height: BOARD_CARD_HEIGHT }}
          />
        )}
        <div
          style={
            virtualize
              ? { height: range.height, position: 'relative' }
              : undefined
          }
        >
          <div style={virtualize ? { transform: `translateY(${range.offset}px)` } : undefined}>
            {lanes.map((lane) => (
              <div key={lane.key}>
                {store.ui.subgroupBy !== 'none' && lane.label && (
                  <div className="px-1 py-1 text-[11px] uppercase tracking-wide text-dim">
                    {lane.label}
                  </div>
                )}
                {(virtualize ? visibleIssues : lane.issues).map((issue) => (
                  <BoardCard key={issue.id} issue={issue} columnStateId={state?.id} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BoardCard({ issue, columnStateId }: { issue: Issue; columnStateId?: string }) {
  const store = useNock()
  const origin = useRef<{ x: number; y: number } | null>(null)
  const assignee = issue.assigneeId ? store.users.get(issue.assigneeId) : undefined
  const highlighted = store.ui.highlightedIssueId === issue.id
  const selected = store.ui.selectedIssueIds.includes(issue.id)
  const dragging = store.ui.drag?.issueIds.includes(issue.id)
  const completed = store.states.get(issue.stateId)?.type === 'completed'

  function beginDrag(): void {
    const ids =
      store.ui.selectedIssueIds.includes(issue.id) && store.ui.selectedIssueIds.length > 0
        ? store.ui.selectedIssueIds
        : [issue.id]
    store.setDrag({
      issueIds: ids,
      fromStateId: issue.stateId,
      overStateId: columnStateId ?? issue.stateId,
      overIndex: null,
    })
  }

  useEffect(() => {
    if (!dragging) return
    const onUp = () => {
      const drag = store.ui.drag
      if (!drag) return
      if (drag.overStateId) {
        store.dropIssuesOnColumn(drag.overStateId, drag.issueIds, drag.overIndex)
      } else {
        store.setDrag(null)
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [dragging, store])

  return (
    <button
      type="button"
      draggable
      data-testid={`board-card-${issue.identifier}`}
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        if (!origin.current || store.ui.drag) return
        const dx = event.clientX - origin.current.x
        const dy = event.clientY - origin.current.y
        if (Math.hypot(dx, dy) < 4) return
        beginDrag()
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', issue.id)
        beginDrag()
      }}
      onClick={() =>
        store.commands.run('selection.toggle', { id: issue.id, exclusive: true })
      }
      onDoubleClick={() => store.commands.run('issue.open', { id: issue.id })}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.code === 'Space') event.preventDefault()
      }}
      className={cn(
        'mb-2 w-full cursor-grab rounded-md border border-line bg-lift px-3 py-2 text-left hover:border-accent/50',
        highlighted && 'ring-1 ring-accent',
        selected && 'border-accent/70 bg-accent/10',
        dragging && 'opacity-50',
        completed && 'opacity-60',
      )}
      style={{ minHeight: BOARD_CARD_HEIGHT - 8 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('text-[13px] leading-5', completed && 'line-through')}>
          {issue.title}
        </div>
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
