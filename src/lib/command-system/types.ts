import type { IssuePatch } from '../commands'
import type { NockStore } from '../store'
import type { Issue, ViewId } from '../types'

export type CommandArgs = Record<string, unknown>

export type InverseAction =
  | { type: 'issue.delete'; ids: string[] }
  | { type: 'issue.restore'; issues: Issue[] }
  | { type: 'issue.patch'; patches: Array<{ id: string; patch: IssuePatch }> }

export type UndoEntry = {
  label: string
  inverse: InverseAction[]
}

export type ShortcutSpec = {
  key: string
  mod?: boolean
  shift?: boolean
  alt?: boolean
  /** Keys that still run while the user is typing. */
  whenTyping?: 'never' | 'always'
}

export type CommandResult = { ok: true; issueId?: string } | { ok: false; error: string }

export type RegisteredCommand = {
  id: string
  label: string
  keywords?: string[]
  shortcut?: ShortcutSpec
  shortcuts?: ShortcutSpec[]
  palette?: boolean
  when: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext, args?: CommandArgs) => CommandResult | void
}

export type CommandHost = {
  view: ViewId
  navigate?: (pathname: string) => void
}

export class CommandContext {
  store: NockStore
  view: ViewId
  typing: boolean
  navigate: ((pathname: string) => void) | undefined

  constructor(input: {
    store: NockStore
    view: ViewId
    typing?: boolean
    navigate?: (pathname: string) => void
  }) {
    this.store = input.store
    this.view = input.view
    this.typing = input.typing ?? false
    this.navigate = input.navigate
  }

  issues(): Issue[] {
    return this.store.issuesForView(this.view)
  }

  actionIds(): string[] {
    return this.store.actionIssueIds()
  }

  selectedIds(): string[] {
    return [...this.store.ui.selectedIssueIds]
  }

  highlightedId(): string | null {
    return this.store.ui.highlightedIssueId
  }

  hasAction(): boolean {
    return this.store.ui.composerOpen || this.actionIds().length > 0
  }

  selectedCount(): number {
    return this.store.ui.selectedIssueIds.length
  }
}
