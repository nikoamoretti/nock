import { describe, expect, it } from 'vitest'
import { MemoryPersistence, type Persistence } from './persist'
import { createBootstrapSnapshot, IDS } from './seed'
import { NockStore } from './store'
import type { Snapshot } from './types'

class LatchPersistence implements Persistence {
  snapshot: Snapshot | null
  saveStarted = false
  private unlock: (() => void) | null = null

  constructor(snapshot: Snapshot | null = null) {
    this.snapshot = snapshot
  }

  async load(): Promise<Snapshot | null> {
    return this.snapshot
  }

  async save(snapshot: Snapshot): Promise<void> {
    this.saveStarted = true
    await new Promise<void>((resolve) => {
      this.unlock = () => {
        this.snapshot = structuredClone(snapshot)
        resolve()
      }
    })
  }

  release(): void {
    this.unlock?.()
  }
}

describe('NockStore', () => {
  it('mints ENG-N identifiers and increments lastSyncId', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const first = store.createIssue({ title: 'First' })
    const second = store.createIssue({ title: 'Second' })
    expect(first.identifier).toBe('ENG-1')
    expect(second.identifier).toBe('ENG-2')
    expect(second.syncId).toBeGreaterThan(first.syncId)
    expect(store.lastSyncId).toBe(second.syncId)
  })

  it('notifies subscribers before persist resolves', async () => {
    const persist = new LatchPersistence()
    const store = NockStore.from(
      createBootstrapSnapshot({ demo: false }),
      persist,
    )
    let ticks = 0
    store.subscribe(() => {
      ticks += 1
    })
    const issue = store.createIssue({ title: 'Hello' })
    expect(issue.title).toBe('Hello')
    expect(ticks).toBe(1)
    expect(persist.snapshot).toBeNull()
    await Promise.resolve()
    expect(persist.saveStarted).toBe(true)
    expect(persist.snapshot).toBeNull()
    persist.release()
    await store.flush()
    expect(persist.snapshot?.issues[0]?.title).toBe('Hello')
  })

  it('keeps the higher syncId on conflicting writes', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const issue = store.createIssue({ title: 'Local' })
    store.applyRemoteIssue({
      ...issue,
      title: 'Stale replica',
      syncId: issue.syncId - 1,
    })
    expect(store.issue(issue.id)?.title).toBe('Local')
    store.applyRemoteIssue({
      ...issue,
      title: ' fresher replica'.trim(),
      syncId: issue.syncId + 4,
    })
    expect(store.issue(issue.id)?.title).toBe('fresher replica')
    expect(store.lastSyncId).toBe(issue.syncId + 4)
  })

  it('hydrates the next issue number from existing rows', () => {
    const snapshot = createBootstrapSnapshot({ demo: true })
    const store = NockStore.from(snapshot)
    const next = store.createIssue({ title: 'After seed' })
    expect(next.number).toBe(snapshot.issues.length + 1)
    expect(next.identifier).toBe(`ENG-${snapshot.issues.length + 1}`)
  })

  it('round-trips through persistence', async () => {
    const persist = new MemoryPersistence()
    const store = await NockStore.open(persist)
    expect([...store.issues.values()]).toHaveLength(0)
    store.createIssue({ title: 'Persisted', stateId: IDS.stateTodo })
    await store.flush()
    const again = await NockStore.open(persist)
    expect(again.issueByIdentifier('ENG-1')?.title).toBe('Persisted')
  })

  it('composer from inbox lands in triage', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.openComposer('inbox')
    store.setComposer({ title: 'Need triage' })
    const issue = store.submitComposer()
    expect(issue?.stateId).toBe(IDS.stateTriage)
    expect(store.ui.composerOpen).toBe(false)
    expect(store.ui.highlightedIssueId).toBe(issue?.id)
    expect(store.ui.peekOpen).toBe(true)
  })

  it('j/k highlight without selecting, x selects, space peeks', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: true }))
    store.highlightRelative('all', 1)
    const highlighted = store.ui.highlightedIssueId
    expect(highlighted).toBeTruthy()
    expect(store.ui.selectedIssueIds).toEqual([])
    expect(store.ui.peekOpen).toBe(false)
    store.toggleSelect()
    expect(store.ui.selectedIssueIds).toEqual([highlighted])
    store.togglePeek()
    expect(store.ui.peekOpen).toBe(true)
    expect(store.peekedIssue()?.id).toBe(highlighted)
    store.dismissOverlays()
    expect(store.ui.peekOpen).toBe(false)
    expect(store.ui.selectedIssueIds).toEqual([highlighted])
    store.dismissOverlays()
    expect(store.ui.selectedIssueIds).toEqual([])
    expect(store.ui.highlightedIssueId).toBe(highlighted)
  })

  it('clicking a row selects it without opening peek', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: true }))
    const issue = store.issuesForView('all')[0]
    store.clickIssue(issue.id)
    expect(store.ui.highlightedIssueId).toBe(issue.id)
    expect(store.ui.selectedIssueIds).toEqual([issue.id])
    expect(store.ui.peekOpen).toBe(false)
  })

  it('accepts and declines triage', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const incoming = store.createIssue({
      title: 'Incoming',
      stateId: IDS.stateTriage,
    })
    store.highlightIssue(incoming.id)
    store.acceptTriage()
    expect(store.issue(incoming.id)?.stateId).toBe(IDS.stateTodo)
    expect(store.issuesForView('inbox').map((row) => row.id)).not.toContain(
      incoming.id,
    )
    const declined = store.createIssue({
      title: 'No thanks',
      stateId: IDS.stateTriage,
    })
    store.highlightIssue(declined.id)
    store.declineTriage()
    expect(store.issue(declined.id)?.stateId).toBe(IDS.stateCanceled)
  })

  it('toggles list/board layout on the same view', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: true }))
    expect(store.effectiveLayout('all')).toBe('list')
    store.toggleLayout('all')
    expect(store.effectiveLayout('all')).toBe('board')
    expect(store.effectiveLayout('inbox')).toBe('list')
    store.toggleLayout('inbox')
    expect(store.ui.layout).toBe('board')
    expect(store.effectiveLayout('inbox')).toBe('list')
  })

  it('applies extra filters and keeps triage out of all', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.createIssue({
      title: 'Triage only',
      stateId: IDS.stateTriage,
      priority: 1,
    })
    const urgent = store.createIssue({
      title: 'Urgent todo',
      stateId: IDS.stateTodo,
      priority: 1,
    })
    store.createIssue({
      title: 'Low',
      stateId: IDS.stateTodo,
      priority: 4,
    })
    expect(store.issuesForView('all').some((row) => row.stateId === IDS.stateTriage)).toBe(
      false,
    )
    store.setFilter('priority', 1)
    expect(store.issuesForView('all').map((row) => row.id)).toEqual([urgent.id])
  })

  it('bulk property changes apply to the selection', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const a = store.createIssue({ title: 'A', stateId: IDS.stateTodo })
    const b = store.createIssue({ title: 'B', stateId: IDS.stateTodo })
    store.clickIssue(a.id)
    store.toggleSelect(b.id)
    store.applyProperty('priority', 2)
    expect(store.issue(a.id)?.priority).toBe(2)
    expect(store.issue(b.id)?.priority).toBe(2)
  })
})
