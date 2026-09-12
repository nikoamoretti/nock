import { useEffect, useRef, useState } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { formatShortcut } from '../lib/command-system'

export function CommandPalette() {
  const store = useNock()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = store.ui.commandQuery
  const [active, setActive] = useState(0)
  const commands = store.commands.paletteItems(query)
  const issues = store.searchIssues(query)
  const activeIndex = commands.length === 0 ? 0 : Math.min(active, commands.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!store.ui.commandOpen) return null

  const runCommand = (id: string) => {
    store.closeCommand()
    store.commands.run(id)
  }

  const runIssue = (id: string) => {
    store.closeCommand()
    store.commands.run('issue.open', { id })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-[16vh]"
      onMouseDown={() => store.commands.run('surface.dismiss')}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="nock-overlay w-[540px] overflow-hidden rounded-xl border border-line bg-lift"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setActive(0)
            store.setCommandQuery(event.target.value)
          }}
          placeholder="Type a command or search…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-dim"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((index) => Math.min(commands.length - 1, index + 1))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(0, index - 1))
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              const command = commands[activeIndex]
              if (command) runCommand(command.id)
              else if (issues[0]) runIssue(issues[0].id)
            }
          }}
        />
        <div className="max-h-[420px] overflow-auto py-1">
          {commands.map((command, index) => (
            <button
              key={command.id}
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-4 py-2 text-left hover:bg-hover',
                index === activeIndex && 'bg-hover',
              )}
              onClick={() => runCommand(command.id)}
            >
              <span>{command.label}</span>
              {command.shortcut && (
                <span className="text-[11px] text-dim">
                  {formatShortcut(command.shortcut)}
                </span>
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
              onClick={() => runIssue(issue.id)}
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

export { CommandPalette as CommandMenu }
