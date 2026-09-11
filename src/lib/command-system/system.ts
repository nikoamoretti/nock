import type { NockStore } from '../store'
import { fuzzyMatch } from '../filters'
import { registerCatalog } from './catalog'
import { CommandRegistry } from './registry'
import { SelectionManager } from './selection'
import { ShortcutManager } from './shortcuts'
import { CommandContext, type CommandArgs, type CommandHost, type CommandResult } from './types'
import { UndoManager } from './undo'
import { formatShortcut, isTypingTarget } from './platform'

function capturingOpen(store: NockStore): boolean {
  return (
    store.ui.helpOpen ||
    store.ui.commandOpen ||
    store.ui.propertyMenu !== null ||
    store.ui.composerOpen
  )
}

export class CommandSystem {
  store: NockStore
  registry = new CommandRegistry()
  shortcuts: ShortcutManager
  selection: SelectionManager
  undo = new UndoManager()
  host: CommandHost = { view: 'all' }
  focusOrigin: HTMLElement | null = null

  constructor(store: NockStore) {
    this.store = store
    this.selection = new SelectionManager(store)
    this.shortcuts = new ShortcutManager(this)
    registerCatalog(this)
  }

  setHost(host: CommandHost): void {
    this.host = host
  }

  context(typing = false): CommandContext {
    return new CommandContext({
      store: this.store,
      view: this.host.view,
      typing,
      navigate: this.host.navigate,
    })
  }

  canRun(id: string, ctx = this.context()): boolean {
    const command = this.registry.get(id)
    return Boolean(command?.when(ctx))
  }

  run(id: string, args?: CommandArgs, ctx = this.context()): CommandResult {
    const command = this.registry.get(id)
    if (!command) return { ok: false, error: `unknown command: ${id}` }
    if (!command.when(ctx)) return { ok: false, error: 'unavailable' }
    try {
      return command.run(ctx, args) ?? { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message }
    }
  }

  paletteItems(query = '', ctx = this.context()) {
    const needle = query.trim()
    return this.registry.paletteItems(ctx).filter((command) =>
      fuzzyMatch(needle, `${command.id} ${command.label} ${(command.keywords ?? []).join(' ')}`),
    )
  }

  handleKey(event: KeyboardEvent): boolean {
    return this.shortcuts.handle(event, this.context(isTypingTarget(event.target)))
  }

  attachWindow(): () => void {
    const onKey = (event: KeyboardEvent) => {
      this.handleKey(event)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      this.shortcuts.detach()
    }
  }

  captureFocus(): void {
    if (typeof document === 'undefined') return
    const active = document.activeElement
    if (active instanceof HTMLElement) this.focusOrigin = active
  }

  restoreFocusIfQuiet(): void {
    if (capturingOpen(this.store)) return
    const origin = this.focusOrigin
    this.focusOrigin = null
    if (origin?.isConnected) origin.focus()
  }

  helpRows(): Array<{ keys: string; action: string }> {
    const rows: Array<{ keys: string; action: string }> = []
    const seen = new Set<string>()
    const skip = new Set([
      'issue.navigate',
      'issue.boardShift',
      'issue.acceptTriage',
      'issue.declineTriage',
      'surface.dismiss',
      'edit.undo',
    ])
    for (const binding of this.shortcuts.bindings) {
      if (seen.has(binding.commandId) || skip.has(binding.commandId)) continue
      const command = this.registry.get(binding.commandId)
      if (!command) continue
      seen.add(binding.commandId)
      const specs = this.shortcuts.bindings
        .filter((row) => row.commandId === binding.commandId)
        .map((row) => formatShortcut(row.spec))
      rows.push({ keys: specs.join(' / '), action: command.label })
    }
    rows.push(
      { keys: 'J / K / ↑ / ↓', action: 'Highlight next / previous' },
      { keys: 'Shift+J / K', action: 'Extend selection' },
      { keys: '[ / ]', action: 'Move board card to previous / next column' },
      { keys: '1 / 3', action: 'Triage accept / decline' },
      { keys: 'G then I T M A B P C', action: 'Go to a view' },
    )
    return rows
  }
}
