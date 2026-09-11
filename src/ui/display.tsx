import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'text-secondary border-line',
  accent: 'text-accent border-accent/30',
  success: 'text-success border-success/30',
  warning: 'text-warning border-warning/30',
  danger: 'text-danger border-danger/30',
  info: 'text-info border-info/30',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[20px] items-center rounded-md border px-1.5 text-[12px]',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Avatar({
  name,
  initials,
  size = 18,
  className,
}: {
  name: string
  initials: string
  size?: number
  className?: string
}) {
  const index = (Math.abs(hash(name)) % 5) + 1
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium text-on-accent',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, size * 0.42),
        background: `var(--avatar-${index})`,
      }}
    >
      {initials}
    </span>
  )
}

function hash(value: string): number {
  let n = 0
  for (const ch of value) n = (n * 31 + ch.charCodeAt(0)) | 0
  return n
}

export function Kbd({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] items-center rounded-sm border border-line px-1 font-[var(--font-mono)] text-[11px] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Separator({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      role="separator"
      className={cn('h-px w-full bg-line', className)}
    />
  )
}
