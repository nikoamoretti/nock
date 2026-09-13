import { useLayoutEffect, useRef, useState } from 'react'
import { FilterBuilder } from './filters/filter-builder'
import { useNock } from '../hooks/use-nock'

export function FilterMenu() {
  const store = useNock()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 48, left: 248 })
  const open = store.ui.filterMenuOpen

  useLayoutEffect(() => {
    if (!open) return
    const button = document.querySelector('[data-testid=filter-button]')
    const panel = panelRef.current
    if (!(button instanceof HTMLElement) || !panel) return
    const rect = button.getBoundingClientRect()
    const width = panel.offsetWidth || 280
    const height = panel.offsetHeight || 360
    const margin = 8
    let left = rect.left
    let top = rect.bottom + margin
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin
    }
    if (left < margin) left = margin
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - margin)
    }
    setPos({ top, left })
  }, [open, store.ui.filterAst, store.ui.filterCombine])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.toggleFilterMenu()}>
      <div
        ref={panelRef}
        className="absolute"
        style={{ top: pos.top, left: pos.left }}
      >
        <FilterBuilder onClose={() => store.toggleFilterMenu()} />
      </div>
    </div>
  )
}
