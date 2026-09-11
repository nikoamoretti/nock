import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Spinner } from './feedback'

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger'
export type ControlSize = 'sm' | 'md'

const SIZE: Record<ControlSize, string> = {
  sm: 'h-[var(--control-sm)] min-w-[var(--control-sm)] px-2 text-[13px]',
  md: 'h-[var(--control-md)] min-w-[var(--control-md)] px-2.5 text-[13px]',
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent/90 disabled:bg-accent/40',
  ghost:
    'bg-transparent text-fg hover:bg-hover disabled:text-disabled',
  quiet:
    'bg-transparent text-secondary hover:bg-hover hover:text-fg disabled:text-disabled',
  danger:
    'bg-transparent text-danger hover:bg-hover disabled:text-disabled',
}

export function Button({
  variant = 'ghost',
  size = 'sm',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ControlSize
  loading?: boolean
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
    >
      {loading && <Spinner size={14} label={false} />}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  size = 'sm',
  variant = 'quiet',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  size?: ControlSize
  variant?: ButtonVariant
  children: ReactNode
}) {
  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn('px-0', className)}
    >
      {children}
    </Button>
  )
}
