import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Spinner({
  size = 16,
  label = 'Loading',
  className,
}: {
  size?: number
  label?: string | false
  className?: string
}) {
  const svg = (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className="ui-spinner"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.6"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
  if (!label) {
    return (
      <span aria-hidden="true" className={cn('inline-flex text-secondary', className)}>
        {svg}
      </span>
    )
  }
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-flex text-secondary', className)}
    >
      {svg}
    </span>
  )
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn('ui-skeleton rounded-md bg-hover', className)}
    />
  )
}

export function ScrollArea({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={cn('ui-scroll overflow-auto', className)}>
      {children}
    </div>
  )
}
