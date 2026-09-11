import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../lib/cn'

export type TabItem = {
  id: string
  label: string
  panel: ReactNode
}

export function Tabs({
  value,
  onValueChange,
  items,
  label,
}: {
  value: string
  onValueChange: (id: string) => void
  items: TabItem[]
  label: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()

  useEffect(() => {
    if (!items.some((item) => item.id === value) && items[0]) {
      onValueChange(items[0].id)
    }
  }, [items, onValueChange, value])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = items[(index + 1) % items.length]
      if (next) onValueChange(next.id)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = items[(index - 1 + items.length) % items.length]
      if (next) onValueChange(next.id)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      if (items[0]) onValueChange(items[0].id)
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = items[items.length - 1]
      if (last) onValueChange(last.id)
    }
  }

  const active = items.find((item) => item.id === value) ?? items[0]

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-0.5 border-b border-line"
      >
        {items.map((item) => {
          const selected = item.id === active?.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-controls={`${baseId}-panel-${item.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.id)}
              className={cn(
                'h-[var(--control-sm)] rounded-t-md px-2 text-[13px]',
                selected ? 'text-fg' : 'text-secondary hover:text-fg',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          className="pt-3 text-[13px] text-fg"
        >
          {active.panel}
        </div>
      )}
    </div>
  )
}
