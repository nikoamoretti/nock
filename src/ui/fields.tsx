import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/cn'

type FieldProps = {
  label: string
  error?: string
  hint?: string
}

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  disabled,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  return (
    <div className="flex flex-col gap-1 text-[13px] text-fg">
      <label htmlFor={fieldId} className="text-[12px] text-secondary">
        {label}
      </label>
      <input
        {...props}
        id={fieldId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'h-[var(--control-md)] rounded-md border border-line bg-panel px-2 text-[13px] text-fg outline-none placeholder:text-muted',
          'disabled:cursor-not-allowed disabled:text-disabled',
          error && 'border-danger',
          className,
        )}
      />
      {hint && !error && (
        <span id={hintId} className="text-[12px] text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-[12px] text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function Textarea({
  label,
  error,
  hint,
  id,
  className,
  disabled,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  return (
    <div className="flex flex-col gap-1 text-[13px] text-fg">
      <label htmlFor={fieldId} className="text-[12px] text-secondary">
        {label}
      </label>
      <textarea
        {...props}
        id={fieldId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'min-h-[88px] rounded-md border border-line bg-panel px-2 py-1.5 text-[13px] leading-[18px] text-fg outline-none placeholder:text-muted',
          'disabled:cursor-not-allowed disabled:text-disabled',
          error && 'border-danger',
          className,
        )}
      />
      {hint && !error && (
        <span id={hintId} className="text-[12px] text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-[12px] text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <label className={cn('inline-flex items-center gap-2 text-[13px] text-fg', className)}>
      <input
        {...props}
        id={id}
        type="checkbox"
        className="size-[14px] accent-[var(--accent)] disabled:opacity-40"
      />
      {label}
    </label>
  )
}

type RadioContextValue = {
  name: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const RadioContext = createContext<RadioContextValue | null>(null)

export function RadioGroup({
  name,
  value,
  onChange,
  label,
  disabled,
  children,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1 text-[12px] text-secondary">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
        <RadioContext.Provider value={{ name, value, onChange, disabled }}>
          {children}
        </RadioContext.Provider>
      </div>
    </fieldset>
  )
}

export function Radio({
  value,
  label,
}: {
  value: string
  label: string
}) {
  const group = useContext(RadioContext)
  if (!group) throw new Error('[nock] Radio must be inside RadioGroup')
  const id = useId()
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-fg">
      <input
        id={id}
        type="radio"
        name={group.name}
        value={value}
        checked={group.value === value}
        disabled={group.disabled}
        onChange={() => group.onChange(value)}
        className="size-[14px] accent-[var(--accent)] disabled:opacity-40"
      />
      {label}
    </label>
  )
}
