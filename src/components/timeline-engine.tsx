import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import {
  DAY_MS,
  deltaMsFromPixels,
  dependencyInvalid,
  moveRange,
  rangeStyle,
  resizeRange,
  timelineWindow,
  type TimelineZoom,
} from '../lib/planning'
import { visibleRange } from '../lib/virtualize'

export const TIMELINE_ROW_HEIGHT = 44

export type TimelineRow = {
  id: string
  label: string
  href?: string
  startAt: number | null
  targetAt: number | null
  milestones?: Array<{ id: string; name: string; targetAt: number | null }>
  blockedByIds?: string[]
}

type DragState = {
  id: string
  mode: 'move' | 'start' | 'end'
  startX: number
  startAt: number
  targetAt: number
}

const ZOOMS: TimelineZoom[] = ['week', 'month', 'quarter', 'year']

export function TimelineEngine({
  rows,
  zoom,
  onZoom,
  now = Date.now(),
  onChange,
}: {
  rows: TimelineRow[]
  zoom: TimelineZoom
  onZoom: (zoom: TimelineZoom) => void
  now?: number
  onChange: (id: string, startAt: number, targetAt: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const frame = timelineWindow(now, zoom)
  const range = visibleRange(rows.length, scrollTop, 520, TIMELINE_ROW_HEIGHT, 6)
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  const commitDrag = (next: DragState, clientX: number) => {
    const width = track.current?.clientWidth ?? 1
    const delta = deltaMsFromPixels(clientX - next.startX, width, frame)
    const range =
      next.mode === 'move'
        ? moveRange(next.startAt, next.targetAt, delta)
        : resizeRange(next.startAt, next.targetAt, next.mode === 'start' ? 'start' : 'end', delta)
    onChange(next.id, range.startAt, range.targetAt)
  }

  const onPointerDown = (
    event: PointerEvent<HTMLElement>,
    row: TimelineRow,
    mode: DragState['mode'],
  ) => {
    if (row.startAt == null || row.targetAt == null) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(row.id)
    setDrag({
      id: row.id,
      mode,
      startX: event.clientX,
      startAt: row.startAt,
      targetAt: row.targetAt,
    })
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    commitDrag(drag, event.clientX)
  }

  const onPointerUp = () => setDrag(null)

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows.find((item) => item.id === selectedId)
    if (!row || row.startAt == null || row.targetAt == null) return
    const step = zoom === 'week' ? DAY_MS : frame.columnMs
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? step : -step
      const next = event.shiftKey
        ? resizeRange(row.startAt, row.targetAt, 'end', delta)
        : moveRange(row.startAt, row.targetAt, delta)
      onChange(row.id, next.startAt, next.targetAt)
    }
  }

  const connectors = rows.flatMap((row) =>
    (row.blockedByIds ?? []).flatMap((sourceId) => {
      const source = byId.get(sourceId)
      if (!source || source.targetAt == null || row.startAt == null) return []
      const invalid = dependencyInvalid(source, row)
      const span = frame.end - frame.start
      return [
        {
          id: `${sourceId}->${row.id}`,
          x1: ((source.targetAt - frame.start) / span) * 100,
          x2: ((row.startAt - frame.start) / span) * 100,
          y1: rows.findIndex((item) => item.id === sourceId),
          y2: rows.findIndex((item) => item.id === row.id),
          invalid,
        },
      ]
    }),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="timeline-engine">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {ZOOMS.map((item) => (
          <button
            key={item}
            type="button"
            data-testid={`timeline-zoom-${item}`}
            className={cn(
              'rounded-md px-2 py-1 text-[12px] capitalize',
              zoom === item ? 'bg-hover text-ink' : 'text-mute hover:bg-hover hover:text-ink',
            )}
            onClick={() => onZoom(item)}
          >
            {item}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-dim">
          Drag bars, resize handles, or use arrow keys / date fields
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[200px] shrink-0 border-r border-line">
          <div className="h-8 border-b border-line px-3 text-[11px] leading-8 text-dim">Name</div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-8 border-b border-line">
            {Array.from({ length: frame.columns }, (_, index) => (
              <div
                key={index}
                className="absolute top-0 h-full border-l border-line/70 text-[10px] text-dim"
                style={{ left: `${(index / frame.columns) * 100}%` }}
              />
            ))}
            <div
              className="absolute top-0 z-10 h-full w-px bg-accent"
              style={{ left: `${frame.todayOffset * 100}%` }}
              data-testid="timeline-today"
            />
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-auto outline-none"
        tabIndex={0}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onKeyDown={onKey}
      >
        <div className="flex" style={{ height: range.height }}>
          <div className="w-[200px] shrink-0">
            <div style={{ height: range.offset }} />
            {rows.slice(range.start, range.end).map((row) => (
              <div
                key={row.id}
                className={cn(
                  'flex items-center truncate border-b border-line px-3 text-[13px]',
                  selectedId === row.id && 'bg-hover',
                )}
                style={{ height: TIMELINE_ROW_HEIGHT }}
                onClick={() => setSelectedId(row.id)}
              >
                {row.href ? (
                  <Link to={row.href} className="truncate hover:text-accent">
                    {row.label}
                  </Link>
                ) : (
                  <span className="truncate">{row.label}</span>
                )}
              </div>
            ))}
          </div>
          <div
            ref={track}
            className="relative min-w-0 flex-1"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="pointer-events-none absolute top-0 z-10 h-full w-px bg-accent/80"
              style={{ left: `${frame.todayOffset * 100}%` }}
            />
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {connectors.map((line) => (
                <line
                  key={line.id}
                  x1={`${line.x1}%`}
                  x2={`${line.x2}%`}
                  y1={line.y1 * TIMELINE_ROW_HEIGHT + TIMELINE_ROW_HEIGHT / 2}
                  y2={line.y2 * TIMELINE_ROW_HEIGHT + TIMELINE_ROW_HEIGHT / 2}
                  stroke={line.invalid ? '#eb5757' : '#6b75f0'}
                  strokeWidth="1.5"
                  strokeDasharray={line.invalid ? '4 3' : undefined}
                />
              ))}
            </svg>
            <div style={{ height: range.offset }} />
            {rows.slice(range.start, range.end).map((row) => {
              const bar = rangeStyle(row, frame)
              return (
                <div
                  key={row.id}
                  className="relative border-b border-line"
                  style={{ height: TIMELINE_ROW_HEIGHT }}
                  data-testid={`timeline-row-${row.id}`}
                >
                  {bar && (
                    <div
                      className="absolute top-2 h-6 cursor-grab rounded-md bg-accent/80"
                      style={bar}
                      onPointerDown={(event) => onPointerDown(event, row, 'move')}
                    >
                      <button
                        type="button"
                        aria-label={`Resize start of ${row.label}`}
                        className="absolute top-0 left-0 h-full w-2 cursor-ew-resize rounded-l-md bg-ink/30"
                        onPointerDown={(event) => onPointerDown(event, row, 'start')}
                      />
                      <button
                        type="button"
                        aria-label={`Resize end of ${row.label}`}
                        className="absolute top-0 right-0 h-full w-2 cursor-ew-resize rounded-r-md bg-ink/30"
                        onPointerDown={(event) => onPointerDown(event, row, 'end')}
                      />
                    </div>
                  )}
                  {(row.milestones ?? []).map((milestone) => {
                    if (milestone.targetAt == null) return null
                    const left =
                      ((milestone.targetAt - frame.start) / (frame.end - frame.start)) * 100
                    return (
                      <div
                        key={milestone.id}
                        title={milestone.name}
                        className="absolute top-1 h-8 w-0 border-l-2 border-ink"
                        style={{ left: `${left}%` }}
                        data-testid={`timeline-milestone-${milestone.id}`}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {selectedId && (
        <DateFields
          row={byId.get(selectedId)}
          onChange={onChange}
        />
      )}
    </div>
  )
}

function DateFields({
  row,
  onChange,
}: {
  row?: TimelineRow
  onChange: (id: string, startAt: number, targetAt: number) => void
}) {
  if (!row) return null
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[12px]">
      <label className="flex items-center gap-2 text-mute">
        Start
        <input
          type="date"
          data-testid={`timeline-start-${row.id}`}
          className="rounded-md border border-line bg-fill px-2 py-1 text-ink"
          value={toDateInput(row.startAt)}
          onChange={(event) => {
            const startAt = fromDateInput(event.target.value, row.startAt)
            const targetAt = row.targetAt ?? startAt + DAY_MS
            onChange(row.id, startAt, Math.max(targetAt, startAt + DAY_MS))
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-mute">
        Target
        <input
          type="date"
          data-testid={`timeline-target-${row.id}`}
          className="rounded-md border border-line bg-fill px-2 py-1 text-ink"
          value={toDateInput(row.targetAt)}
          onChange={(event) => {
            const targetAt = fromDateInput(event.target.value, row.targetAt)
            const startAt = row.startAt ?? targetAt - DAY_MS
            onChange(row.id, startAt, Math.max(targetAt, startAt + DAY_MS))
          }}
        />
      </label>
    </div>
  )
}

function toDateInput(ts: number | null): string {
  if (ts == null) return ''
  return new Date(ts).toISOString().slice(0, 10)
}

function fromDateInput(value: string, fallback: number | null): number {
  if (!value) return fallback ?? Date.now()
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed) ? (fallback ?? Date.now()) : parsed
}
