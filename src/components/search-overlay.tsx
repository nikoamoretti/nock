import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { projectPath } from '../lib/paths'
import {
  flattenSearchResults,
  searchRowKey,
  type SearchDocument,
} from '../lib/search'
import { OverlayShell } from './overlay-shell'

export function SearchOverlay() {
  const store = useNock()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = store.ui.searchQuery
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const results = flattenSearchResults(
    query.trim() ? store.searchDocuments(query) : [],
  )
  const activeIndex = Math.max(
    0,
    activeKey ? results.findIndex((row) => searchRowKey(row) === activeKey) : 0,
  )
  const clampedIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1)
  const activeRow = results[clampedIndex]
  const activeId = activeRow ? `search-option-${searchRowKey(activeRow)}` : undefined

  const resultSignature = results.map((row) => searchRowKey(row)).join('|')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (results.length === 0) {
      setActiveKey(null)
      return
    }
    setActiveKey((current) =>
      current && results.some((row) => searchRowKey(row) === current)
        ? current
        : searchRowKey(results[0]),
    )
  }, [resultSignature, results])

  useEffect(() => {
    if (!activeId) return
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (!store.ui.searchOpen) return null

  const open = (row: SearchDocument) => {
    store.setSearchError(null)
    if (row.type === 'issue') {
      const result = store.commands.run('issue.open', {
        id: row.id,
        surface: 'search',
      })
      if (!result.ok) {
        store.setSearchError(result.error)
        return
      }
      store.closeSearch()
      return
    }
    if (row.type === 'project') {
      navigate(projectPath(row.id, store.routeScope()))
      store.closeSearch()
      return
    }
    const result = store.commands.run('document.open', { id: row.id })
    if (!result.ok) {
      store.setSearchError(result.error)
      return
    }
    store.closeSearch()
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
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="workspace-search-results"
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        onChange={(event) => {
          store.setSearchQuery(event.target.value)
        }}
        placeholder="Search issues, projects, documents…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-dim"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = results[Math.min(results.length - 1, clampedIndex + 1)]
            if (next) setActiveKey(searchRowKey(next))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = results[Math.max(0, clampedIndex - 1)]
            if (next) setActiveKey(searchRowKey(next))
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (activeRow) open(activeRow)
          }
        }}
      />
      {store.ui.searchError && (
        <div
          data-testid="search-error"
          className="border-b border-line px-4 py-2 text-[12px] text-red-400"
        >
          {store.ui.searchError}
        </div>
      )}
      <div
        id="workspace-search-results"
        role="listbox"
        aria-label="Search results"
        className="max-h-[420px] overflow-auto py-1"
      >
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
                  const key = searchRowKey(row)
                  const selected = key === (activeRow ? searchRowKey(activeRow) : '')
                  return (
                    <button
                      key={key}
                      id={`search-option-${key}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-testid={`search-result-${row.type}-${row.id}`}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover',
                        selected && 'bg-hover',
                      )}
                      onMouseEnter={() => setActiveKey(key)}
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
