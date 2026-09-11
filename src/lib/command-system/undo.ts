import type { NockStore } from '../store'
import type { InverseAction, UndoEntry } from './types'

export class UndoManager {
  private stack: UndoEntry[] = []

  get depth(): number {
    return this.stack.length
  }

  peek(): UndoEntry | undefined {
    return this.stack[this.stack.length - 1]
  }

  entries(): UndoEntry[] {
    return [...this.stack]
  }

  push(label: string, inverse: InverseAction[]): void {
    this.stack.push({ label, inverse })
  }

  clear(): void {
    this.stack = []
  }

  undo(store: NockStore): boolean {
    const entry = this.stack.pop()
    if (!entry) return false
    applyInverse(store, entry.inverse)
    return true
  }
}

export function applyInverse(store: NockStore, inverse: InverseAction[]): void {
  for (const action of inverse) {
    if (action.type === 'issue.delete') {
      for (const id of action.ids) {
        if (store.issue(id)) store.deleteIssue(id)
      }
    } else if (action.type === 'issue.restore') {
      for (const issue of action.issues) store.restoreIssue(issue)
    } else {
      for (const row of action.patches) {
        if (store.issue(row.id)) store.updateIssue(row.id, row.patch)
      }
    }
  }
}
