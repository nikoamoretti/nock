import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbPersistence } from './persist'
import { createBootstrapSnapshot } from './seed'
import { NockStore } from './store'

describe('IdbPersistence', () => {
  it('reloads the object pool after a new store opens', async () => {
    const persist = new IdbPersistence()
    const first = NockStore.from(createBootstrapSnapshot({ demo: false }), persist)
    first.createIssue({ title: 'On disk' })
    await first.flush()

    const second = await NockStore.open(persist)
    expect(second.issueByIdentifier('ENG-1')?.title).toBe('On disk')
    expect(second.lastSyncId).toBe(first.lastSyncId)
  })
})
