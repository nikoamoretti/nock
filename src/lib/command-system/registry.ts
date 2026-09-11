import type { CommandContext, RegisteredCommand } from './types'

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>()

  register(command: RegisteredCommand): void {
    this.commands.set(command.id, command)
  }

  get(id: string): RegisteredCommand | undefined {
    return this.commands.get(id)
  }

  all(): RegisteredCommand[] {
    return [...this.commands.values()]
  }

  available(ctx: CommandContext): RegisteredCommand[] {
    return this.all().filter((command) => command.when(ctx))
  }

  paletteItems(ctx: CommandContext): RegisteredCommand[] {
    return this.available(ctx).filter((command) => command.palette !== false)
  }
}
