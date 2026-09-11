import type { NockStore } from '../store'
import type { ViewId } from '../types'

export class SelectionManager {
  store: NockStore

  constructor(store: NockStore) {
    this.store = store
  }

  click(id: string): void {
    this.store.ui.highlightedIssueId = id
    this.store.ui.selectedIssueIds = [id]
    this.store.ui.selectionAnchorId = id
    this.store.ui.propertyMenu = null
    this.store.bump()
  }

  toggle(id?: string): void {
    const target = id ?? this.store.ui.highlightedIssueId
    if (!target) return
    this.store.ui.highlightedIssueId = target
    const selected = new Set(this.store.ui.selectedIssueIds)
    if (selected.has(target)) selected.delete(target)
    else selected.add(target)
    this.store.ui.selectedIssueIds = [...selected]
    this.store.ui.selectionAnchorId = target
    this.store.bump()
  }

  range(view: ViewId, targetId: string): void {
    const issues = this.store.issuesForView(view)
    const anchor =
      this.store.ui.selectionAnchorId ?? this.store.ui.highlightedIssueId
    if (!anchor) {
      this.click(targetId)
      return
    }
    const from = issues.findIndex((issue) => issue.id === anchor)
    const to = issues.findIndex((issue) => issue.id === targetId)
    if (from < 0 || to < 0) {
      this.toggle(targetId)
      return
    }
    const [lo, hi] = from < to ? [from, to] : [to, from]
    this.store.ui.selectedIssueIds = issues.slice(lo, hi + 1).map((issue) => issue.id)
    this.store.ui.highlightedIssueId = targetId
    this.store.ui.propertyMenu = null
    this.store.bump()
  }

  all(view: ViewId): void {
    const issues = this.store.issuesForView(view)
    this.store.ui.selectedIssueIds = issues.map((issue) => issue.id)
    this.store.ui.selectionAnchorId = issues[0]?.id ?? null
    if (!this.store.ui.highlightedIssueId && issues[0]) {
      this.store.ui.highlightedIssueId = issues[0].id
    }
    this.store.bump()
  }

  clear(): void {
    this.store.ui.selectedIssueIds = []
    this.store.ui.selectionAnchorId = null
    this.store.bump()
  }
}
