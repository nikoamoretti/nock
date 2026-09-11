import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { searchFromFilters } from '../lib/url-filters'

const COMMANDS = [
  { id: 'new', label: 'New issue', hint: 'C', path: null },
  { id: 'inbox', label: 'Go to Inbox', hint: 'G I', path: '/inbox' },
  { id: 'mine', label: 'Go to My issues', hint: 'G M', path: '/my-issues' },
  { id: 'all', label: 'Go to All issues', hint: 'G A', path: '/eng/all' },
  { id: 'board', label: 'Toggle board layout', hint: '⌘B', path: '/eng/board' },
  { id: 'projects', label: 'Go to Projects', hint: 'G P', path: '/projects' },
  { id: 'cycles', label: 'Go to Cycles', hint: 'G C', path: '/cycles' },
  { id: 'reset', label: 'Clear all issues', hint: '', path: null },
] as const

export function CommandMenu() {
  const store = useNock()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = store.ui.commandQuery

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commands = useMemo(
    () =>
      COMMANDS.filter((command) =>
        command.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  )
  const go = (pathname: string) => {
    navigate({ pathname, search: searchFromFilters(store.ui.filters) })
  }
  const issues = store.searchIssues(query)

  if (!store.ui.commandOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-[16vh]"
      onMouseDown={() => store.dismissOverlays()}
    >
      <div
        className="w-[540px] overflow-hidden rounded-xl border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => store.setCommandQuery(event.target.value)}
          placeholder="Type a command or search…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-dim"
        />
        <div className="max-h-[420px] overflow-auto py-1">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-hover"
              onClick={() => {
                store.closeCommand()
                if (command.id === 'new') store.openComposer()
                else if (command.id === 'reset') void store.resetDemo()
                else if (command.id === 'board') {
                  store.setLayout('board')
                  go('/eng/all')
                } else if (command.path) go(command.path)
              }}
            >
              <span>{command.label}</span>
              {command.hint && (
                <span className="text-[11px] text-dim">{command.hint}</span>
              )}
            </button>
          ))}
          {issues.length > 0 && (
            <div className="px-4 py-1 text-[11px] uppercase tracking-wide text-dim">
              Issues
            </div>
          )}
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover',
                store.ui.highlightedIssueId === issue.id && 'bg-hover',
              )}
              onMouseEnter={() => store.previewIssue(issue.id)}
              onClick={() => {
                store.openIssuePeek(issue.id)
                go('/eng/all')
              }}
            >
              <span className="w-14 shrink-0 text-[12px] text-mute">
                {issue.identifier}
              </span>
              <span className="truncate">{issue.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
