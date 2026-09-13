import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { projectPath } from '../lib/paths'
import type { SearchDocument } from '../lib/search'
import { OverlayShell } from './overlay-shell'

export function SearchOverlay() {
  const store = useNock()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = store.ui.searchQuery
  const [active, setActive] = useState(0)
  const results = query.trim() ? store.searchDocuments(query) : []
  const activeIndex = results.length === 0 ? 0 : Math.min(active, results.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!store.ui.searchOpen) return null

  const open = (row: SearchDocument) => {
    store.closeSearch()
    if (row.type === 'issue') {
      store.commands.run('issue.open', { id: row.id })
      return
    }
    if (row.type === 'project') {
      navigate(projectPath(row.id, store.routeScope()))
    }
  }

  const grouped = {
    issue: results.filter((row) => row.type === 'issue'),
    project: results.filter((row) => row.type === 'project'),
    document: results.filter((row) => row.type === 'document'),
  }

  return (
    <OverlayShell
      label="Search"
      onDismiss={() => store.commands.run('surface.dismiss')}
    >
      <input
        ref={inputRef}
        value={query}
        data-testid="workspace-search"
        onChange={(event) => {
          setActive(0)
          store.setSearchQuery(event.target.value)
        }}
        placeholder="Search issues, projects, documents…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-dim"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((index) => Math.min(results.length - 1, index + 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((index) => Math.max(0, index - 1))
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const row = results[activeIndex]
            if (row) open(row)
          }
        }}
      />
      <div className="max-h-[420px] overflow-auto py-1">
        {results.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-mute">
            {query.trim() ? 'No matching results' : 'Type to search this workspace'}
          </div>
        ) : (
          (['issue', 'project', 'document'] as const).map((type) => {
            const rows = grouped[type]
            if (rows.length === 0) return null
            return (
              <div key={type}>
                <div className="px-4 py-1 text-[11px] uppercase tracking-wide text-dim">
                  {type === 'issue' ? 'Issues' : type === 'project' ? 'Projects' : 'Documents'}
                </div>
                {rows.map((row) => {
                  const index = results.indexOf(row)
                  return (
                    <button
                      key={`${row.type}-${row.id}`}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover',
                        index === activeIndex && 'bg-hover',
                      )}
                      onClick={() => open(row)}
                    >
                      {row.identifier && (
                        <span className="w-14 shrink-0 text-[12px] text-mute">
                          {row.identifier}
                        </span>
                      )}
                      <span className="truncate">{row.title}</span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </OverlayShell>
  )
}
