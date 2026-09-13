import { eventMatchesShortcut, isTypingTarget } from './platform'
import type { CommandSystem } from './system'
import type { CommandArgs, CommandContext, ShortcutSpec } from './types'
import type { NockStore } from '../store'

export type ShortcutBinding = {
  spec: ShortcutSpec
  commandId: string
  args?: CommandArgs
  argsFrom?: (event: KeyboardEvent) => CommandArgs
}

const GO_COMMANDS: Record<string, string> = {
  i: 'nav.inbox',
  t: 'nav.inbox',
  m: 'nav.myIssues',
  a: 'nav.all',
  b: 'nav.board',
  p: 'nav.projects',
  c: 'nav.cycles',
  n: 'nav.initiatives',
  y: 'nav.currentCycle',
}

export class ShortcutManager {
  system: CommandSystem
  bindings: ShortcutBinding[] = []
  private go = false
  private goTimer = 0

  constructor(system: CommandSystem) {
    this.system = system
  }

  bind(spec: ShortcutSpec, commandId: string, args?: CommandArgs): void {
    this.bindings.push({ spec, commandId, args })
  }

  handle(event: KeyboardEvent, ctx: CommandContext): boolean {
    if (event.defaultPrevented) return false

    const typing = isTypingTarget(event.target)
    const capturing = capturingOpen(this.system.store)

    if (this.go && !typing && !capturing) {
      this.go = false
      window.clearTimeout(this.goTimer)
      const commandId = GO_COMMANDS[event.key.toLowerCase()]
      if (commandId && this.system.canRun(commandId, ctx)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.system.run(commandId, undefined, ctx)
        return true
      }
    }

    if (!typing && !capturing && event.key.toLowerCase() === 'g' && !eventHasModSafe(event) && !event.shiftKey) {
      this.go = true
      window.clearTimeout(this.goTimer)
      this.goTimer = window.setTimeout(() => {
        this.go = false
      }, 800)
      return true
    }

    for (const binding of this.bindings) {
      if (!eventMatchesShortcut(event, binding.spec)) continue
      const allowTyping = binding.spec.whenTyping === 'always'
      if ((typing || capturing) && !allowTyping) continue
      if (!this.system.canRun(binding.commandId, ctx, binding.args)) continue
      event.preventDefault()
      event.stopImmediatePropagation()
      const args = binding.argsFrom?.(event) ?? binding.args
      this.system.run(binding.commandId, args, ctx)
      return true
    }
    return false
  }

  detach(): void {
    this.go = false
    window.clearTimeout(this.goTimer)
  }
}

function eventHasModSafe(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function capturingOpen(store: NockStore): boolean {
  return (
    store.ui.helpOpen ||
    store.ui.commandOpen ||
    store.ui.searchOpen ||
    store.ui.propertyMenu !== null ||
    store.ui.composerOpen ||
    store.ui.filterMenuOpen ||
    store.ui.displayMenuOpen
  )
}
