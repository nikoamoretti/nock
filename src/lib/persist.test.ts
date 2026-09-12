import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbPersistence } from './persist'
import { createBootstrapSnapshot, IDS } from './seed'
import { NockStore } from './store'

describe('IdbPersistence', () => {
  it('reloads the object pool after a new store opens', async () => {
    const persist = new IdbPersistence()
    const first = NockStore.from(createBootstrapSnapshot({ demo: false }), persist)
    first.createIssue({ title: 'On disk' })
    await first.flushSync()

    const second = await NockStore.open(persist)
    expect(second.issueByIdentifier('ENG-1')?.title).toBe('On disk')
    expect(second.lastSyncId).toBe(first.lastSyncId)
  })

  it('reloads inbox notifications, snoozes, and delivery preferences', async () => {
    const persist = new IdbPersistence('nock-inbox-persist')
    const first = NockStore.from(createBootstrapSnapshot({ demo: false }), persist)
    const incoming = first.createIssue({ title: 'Later', stateId: IDS.stateTriage })
    first.snoozes.set(incoming.id, Date.now() + 60_000)
    first.setDeliveryPreference('mention', false)
    first.notifications.set('n_keep', {
      id: 'n_keep',
      userId: first.currentUserId,
      type: 'mention',
      title: 'Kept',
      body: 'body',
      sourceType: 'issue',
      sourceId: incoming.id,
      readAt: null,
      archivedAt: null,
      priorityScore: 0,
      priorityOverride: null,
      createdAt: Date.now(),
    })
    first.queuePersist()
    await first.flushSync()

    const second = await NockStore.open(persist)
    expect(second.notifications.get('n_keep')?.title).toBe('Kept')
    expect(second.snoozes.get(incoming.id)).toBeTruthy()
    expect(second.inboxDelivery.mention).toBe(false)
  })
})
