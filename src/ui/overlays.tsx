import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { Button } from './button'
import { useEscape, useFocusTrap, useRestoreFocus } from './overlay'

export function Tooltip({
  content,
  children,
}: {
  content: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <span className="ui-tooltip-wrap relative inline-flex">
      <span aria-describedby={id}>{children}</span>
      <span
        id={id}
        role="tooltip"
        className="ui-tooltip pointer-events-none absolute bottom-full left-1/2 z-[var(--z-dropdown)] mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-elevated px-1.5 py-0.5 text-[12px] text-fg"
      >
        {content}
      </span>
    </span>
  )
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  label: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEscape(open, () => onOpenChange(false))
  useRestoreFocus(open)
  useFocusTrap(panelRef, open)
  return (
    <span className="relative inline-flex">
      <span onClick={() => onOpenChange(!open)}>{trigger}</span>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className="nock-overlay absolute left-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] min-w-[220px] rounded-lg border border-line bg-elevated p-1 shadow-[var(--shadow-md)]"
        >
          {children}
        </div>
      )}
    </span>
  )
}

export type MenuItem = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

function MenuList({
  items,
  onClose,
  labelledBy,
}: {
  items: MenuItem[]
  onClose: () => void
  labelledBy?: string
}) {
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    rootRef.current?.focus()
  }, [])
  if (items.length === 0) return null
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % items.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + items.length) % items.length)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = items[active]
      if (item && !item.disabled) {
        item.onSelect()
        onClose()
      }
    }
  }
  return (
    <div
      ref={rootRef}
      role="menu"
      aria-labelledby={labelledBy}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex min-w-[200px] flex-col p-1 outline-none"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={-1}
          className={cn(
            'h-[var(--control-sm)] rounded-md px-2 text-left text-[13px] text-fg hover:bg-hover disabled:text-disabled',
            index === active && 'bg-hover',
          )}
          onMouseEnter={() => setActive(index)}
          onClick={() => {
            if (item.disabled) return
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function DropdownMenu({
  label,
  items,
}: {
  label: string
  items: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  useEscape(open, () => setOpen(false))
  return (
    <span className="relative inline-flex">
      <Button
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open && (
        <div className="nock-overlay absolute left-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] rounded-lg border border-line bg-elevated shadow-[var(--shadow-md)]">
          <MenuList
            items={items}
            labelledBy={triggerId}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </span>
  )
}

export function ContextMenu({
  items,
  children,
}: {
  items: MenuItem[]
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEscape(open, () => setOpen(false))
  return (
    <span
      onContextMenu={(event) => {
        event.preventDefault()
        setPos({ x: event.clientX, y: event.clientY })
        setOpen(true)
      }}
      onKeyDown={(event) => {
        if (event.shiftKey && event.key === 'F10') {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          setPos({ x: rect.left, y: rect.bottom })
          setOpen(true)
        }
      }}
    >
      {children}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[var(--z-dropdown)]"
            onMouseDown={() => setOpen(false)}
          >
            <div
              className="nock-overlay rounded-lg border border-line bg-elevated shadow-[var(--shadow-md)]"
              style={
                {
                  position: 'fixed',
                  left: pos.x,
                  top: pos.y,
                } satisfies CSSProperties
              }
              onMouseDown={(event) => event.stopPropagation()}
            >
              <MenuList items={items} onClose={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}

function OverlayFrame({
  open,
  onClose,
  title,
  children,
  className,
  labelledBy,
  frameClassName,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className: string
  labelledBy: string
  frameClassName: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEscape(open, onClose)
  useRestoreFocus(open)
  useFocusTrap(panelRef, open)
  if (!open) return null
  return createPortal(
    <div
      className={cn('fixed inset-0 z-[var(--z-overlay)] flex bg-scrim', frameClassName)}
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn('nock-overlay border border-line bg-elevated shadow-[var(--shadow-md)]', className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-[var(--control-md)] items-center justify-between border-b border-line px-3">
          <h2 id={labelledBy} className="font-display text-[13px] font-medium">
            {title}
          </h2>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="p-3 text-[13px] text-fg">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <OverlayFrame
      open={open}
      onClose={onClose}
      title={title}
      labelledBy={titleId}
      className="mx-auto mt-[12vh] w-[420px] rounded-lg"
      frameClassName="items-start justify-center"
    >
      {children}
    </OverlayFrame>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <OverlayFrame
      open={open}
      onClose={onClose}
      title={title}
      labelledBy={titleId}
      className="h-full w-[420px] border-l"
      frameClassName="justify-end"
    >
      {children}
    </OverlayFrame>
  )
}
