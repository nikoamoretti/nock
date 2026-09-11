import type { CSSProperties } from 'react'
import type { Priority, WorkflowState } from '../lib/types'

export function NockMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <path
        d="M6 12h9M12 7l5 5-5 5"
        fill="none"
        stroke="var(--fg-on-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StatusIcon({
  state,
  size = 14,
}: {
  state: WorkflowState
  size?: number
}) {
  const style: CSSProperties = { width: size, height: size, flex: 'none' }
  const color = state.color
  switch (state.type) {
    case 'triage':
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <path d="M7 2.2 12.5 12H1.5L7 2.2Z" fill={color} />
        </svg>
      )
    case 'backlog':
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <circle
            cx="7"
            cy="7"
            r="5"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeDasharray="2.5 2"
          />
        </svg>
      )
    case 'unstarted':
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.6" />
        </svg>
      )
    case 'started':
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.6" />
          <path d="M7 2a5 5 0 0 1 0 10Z" fill={color} />
        </svg>
      )
    case 'completed':
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <circle cx="7" cy="7" r="6" fill={color} />
          <path
            d="M4.2 7.1 6.2 9.2 9.8 5"
            fill="none"
            stroke="var(--bg-app)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.6" />
          <path d="M4 7h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
  }
}

export function PriorityIcon({
  priority,
  size = 14,
}: {
  priority: Priority
  size?: number
}) {
  const style: CSSProperties = { width: size, height: size, flex: 'none' }
  if (priority === 0) {
    return (
      <svg viewBox="0 0 14 14" style={style} className="text-dim" aria-hidden="true">
        <circle
          cx="7"
          cy="7"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="2 2"
        />
      </svg>
    )
  }
  if (priority === 1) {
    return (
      <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
        <path d="M7 1.5 12.5 12H1.5L7 1.5Z" fill="var(--danger)" />
        <path
          d="M7 6v2.4"
          stroke="var(--bg-app)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="7" cy="10.4" r="0.7" fill="var(--bg-app)" />
      </svg>
    )
  }
  const bars = priority === 2 ? 3 : priority === 3 ? 2 : 1
  const color =
    priority === 2 ? 'var(--warning)' : priority === 3 ? 'var(--warning)' : 'var(--fg-secondary)'
  return (
    <svg viewBox="0 0 14 14" style={style} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2.4 + i * 3.2}
          y={10 - (i + 1) * 2.4}
          width="2.2"
          height={(i + 1) * 2.4}
          rx="0.6"
          fill={i < bars ? color : 'var(--border-strong)'}
        />
      ))}
    </svg>
  )
}
