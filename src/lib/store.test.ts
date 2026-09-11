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
    store.createIssue({ title: 'Persisted', stateId: IDS.stateTodo })
    await store.flush()
    const again = await NockStore.open(persist)
    expect(again.issueByIdentifier('ENG-13')?.title).toBe('Persisted')
  })

  it('composer from inbox lands in triage', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.openComposer('inbox')
    store.setComposer({ title: 'Need triage' })
    const issue = store.submitComposer()
    expect(issue?.stateId).toBe(IDS.stateTriage)
    expect(store.ui.composerOpen).toBe(false)
  })
})
