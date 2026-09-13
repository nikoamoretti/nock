import { useEffect, useRef, useState } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { formatShortcut } from '../lib/command-system'
import { OverlayShell } from './overlay-shell'

export function CommandPalette() {
  const store = useNock()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = store.ui.commandQuery
  const [active, setActive] = useState(0)
  const commands = store.commands.paletteItems(query)
  const activeIndex = commands.length === 0 ? 0 : Math.min(active, commands.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!store.ui.commandOpen) return null

  const runCommand = (id: string) => {
    store.closeCommand()
    store.commands.run(id)
  }

  return (
    <OverlayShell
      label="Command palette"
      onDismiss={() => store.commands.run('surface.dismiss')}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setActive(0)
          store.setCommandQuery(event.target.value)
        }}
        placeholder="Type a command…"
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
        {commands.length === 0 && (
          <div className="px-4 py-6 text-[13px] text-mute">No matching commands</div>
        )}
      </div>
    </OverlayShell>
  )
}

export { CommandPalette as CommandMenu }
