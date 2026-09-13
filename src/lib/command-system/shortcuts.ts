import { eventMatchesShortcut, isTypingTarget } from './platform'
import type { CommandSystem } from './system'
import type { CommandArgs, CommandContext, ShortcutSpec } from './types'

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

    if (this.go && !typing) {
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

    if (!typing && event.key.toLowerCase() === 'g' && !eventHasModSafe(event) && !event.shiftKey) {
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
      if (typing && !allowTyping) continue
      if (!this.system.canRun(binding.commandId, ctx)) continue
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
