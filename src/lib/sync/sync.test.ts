import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ImmediateAckBackend, ScriptedBackend } from './backend'
import { IdbPersistence, MemoryPersistence } from '../persist'
import { createBootstrapSnapshot, IDS } from '../seed'
import { NockStore } from '../store'

function emptyStore(
  persist = new MemoryPersistence(),
  options?: { backend?: ImmediateAckBackend | ScriptedBackend; online?: boolean },
) {
  return NockStore.from(createBootstrapSnapshot({ demo: false }), persist, options)
}

describe('normalized entity store + sync', () => {
  it('A. update while online applies immediately without a spinner', async () => {
    const backend = new ImmediateAckBackend()
    const store = emptyStore(new MemoryPersistence(), { backend })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    await store.flushSync()
    const beforeRevision = store.issue(issue.id)!.revision

    store.updateIssue(issue.id, { title: 'Online' })
    expect(store.issue(issue.id)?.title).toBe('Online')
    expect(store.sync.showsSpinner).toBe(false)
    expect(store.sync.pending()[0]?.clientMutationId).toBeTruthy()
    expect(store.issuesForView('all').find((row) => row.id === issue.id)).toBe(
      store.issue(issue.id),
    )

    await store.flushSync()
    expect(store.sync.showsSpinner).toBe(false)
    expect(store.sync.statusForIssue(issue.id)).toBeNull()
    expect(store.issue(issue.id)?.title).toBe('Online')
    expect(store.issue(issue.id)!.revision).toBeGreaterThan(beforeRevision)
    expect(store.issue(issue.id)!.lastMutationId).toBeTruthy()
    expect(backend.submits.some((row) => row.patch?.title === 'Online')).toBe(true)
  })

  it('B. update while offline stays queued with the optimistic value', async () => {
    const store = emptyStore(new MemoryPersistence(), { online: false })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    store.updateIssue(issue.id, { title: 'Offline' })
    expect(store.issue(issue.id)?.title).toBe('Offline')
    expect(store.sync.statusForIssue(issue.id)).toBe('queued')
    expect(store.sync.pending().every((command) => command.clientMutationId)).toBe(true)
    await store.flush()
    expect(store.serialize().pendingCommands).toHaveLength(2)
    expect(store.sync.showsSpinner).toBe(false)
  })

  it('C. refresh while a mutation is queued restores entities and the queue', async () => {
    const persist = new IdbPersistence('nock-sync-refresh')
    const store = emptyStore(persist, { online: false })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    store.updateIssue(issue.id, { title: 'Queued across refresh' })
    await store.flush()

    const loaded = await persist.load()
    expect(loaded?.pendingCommands.length).toBeGreaterThan(0)
    const reloaded = NockStore.from(loaded!, persist, { online: false })
    expect(reloaded.issue(issue.id)?.title).toBe('Queued across refresh')
    expect(reloaded.sync.pending().length).toBeGreaterThan(0)
    expect(reloaded.sync.pending().every((command) => command.status === 'queued')).toBe(
      true,
    )
    expect(
      reloaded.sync.pending().some((command) => command.patch?.title === 'Queued across refresh'),
    ).toBe(true)
  })

  it('D. reconnect sends queued commands and acknowledges them', async () => {
    const backend = new ScriptedBackend()
    const persist = new MemoryPersistence()
    const store = emptyStore(persist, { backend, online: false })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    store.updateIssue(issue.id, { title: 'After reconnect' })
    await store.flush()
    expect(backend.submits).toHaveLength(0)

    await store.sync.reconnect()
    await store.flush()
    expect(store.issue(issue.id)?.title).toBe('After reconnect')
    expect(store.sync.statusForIssue(issue.id)).toBeNull()
    expect(store.issue(issue.id)!.lastMutationId).toBeTruthy()
    expect(backend.submits.length).toBeGreaterThan(0)
  })

  it('E. duplicate mutation retry applies the ack once', async () => {
    const backend = new ImmediateAckBackend()
    const store = emptyStore(new MemoryPersistence(), { backend })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    await store.flushSync()
    store.updateIssue(issue.id, { title: 'Once' })
    await store.flushSync()
    const mutationId = store.issue(issue.id)!.lastMutationId!
    const revision = store.issue(issue.id)!.revision
    expect(backend.uniqueSubmitCount(mutationId)).toBe(1)

    const again = await backend.submit({
      clientMutationId: mutationId,
      kind: 'issue.upsert',
      issueId: issue.id,
      patch: { title: 'Once' },
    })
    expect(again.ok).toBe(true)
    expect(again.clientMutationId).toBe(mutationId)
    expect(backend.uniqueSubmitCount(mutationId)).toBe(2)

    expect(
      store.sync.applyRemote({
        mutationId,
        revision: revision + 9,
        issueId: issue.id,
        patch: { title: 'Should ignore' },
      }),
    ).toBe('duplicate')
    expect(store.issue(issue.id)?.title).toBe('Once')
    expect(store.issue(issue.id)?.revision).toBe(revision)
  })

  it('F. remote update to a different field merges without dropping the local patch', async () => {
    const store = emptyStore(new MemoryPersistence(), { online: false })
    const issue = store.createIssue({
      title: 'Local title',
      description: 'old',
      stateId: IDS.stateTodo,
    })
    await store.flush()
    store.updateIssue(issue.id, { title: 'Still local' })
    const remote = store.issue(issue.id)!
    const outcome = store.sync.applyRemote({
      mutationId: 'remote-desc',
      revision: remote.revision + 5,
      issueId: issue.id,
      patch: { description: 'from server' },
    })
    expect(outcome).toBe('applied')
    expect(store.issue(issue.id)?.title).toBe('Still local')
    expect(store.issue(issue.id)?.description).toBe('from server')
    expect(store.sync.statusForIssue(issue.id)).toBe('queued')
  })

  it('G. remote update to the same field is a conflict and keeps the local value', async () => {
    const store = emptyStore(new MemoryPersistence(), { online: false })
    const issue = store.createIssue({ title: 'Mine', stateId: IDS.stateTodo })
    await store.flush()
    store.updateIssue(issue.id, { title: 'Mine now' })
    const remote = store.issue(issue.id)!
    const outcome = store.sync.applyRemote({
      mutationId: 'remote-title',
      revision: remote.revision + 5,
      issueId: issue.id,
      patch: { title: 'Theirs' },
    })
    expect(outcome).toBe('conflict')
    expect(store.issue(issue.id)?.title).toBe('Mine now')
    expect(store.sync.statusForIssue(issue.id)).toBe('conflict')
  })

  it('H. server validation rejection applies the inverse and marks failed', async () => {
    const backend = new ImmediateAckBackend()
    const store = emptyStore(new MemoryPersistence(), { backend })
    const issue = store.createIssue({ title: 'Draft', stateId: IDS.stateTodo })
    await store.flushSync()
    backend.rejectNext = 'title too short'
    store.updateIssue(issue.id, { title: 'x' })
    expect(store.issue(issue.id)?.title).toBe('x')
    await store.flushSync()
    expect(store.issue(issue.id)?.title).toBe('Draft')
    expect(store.sync.statusForIssue(issue.id)).toBe('failed')
    expect(store.sync.command(store.sync.pending()[0]!.clientMutationId)?.error).toBe(
      'title too short',
    )
  })

  it('I. remote delete of an open issue removes it and conflicts pending work', async () => {
    const store = emptyStore(new MemoryPersistence(), { online: false })
    const issue = store.createIssue({ title: 'Open', stateId: IDS.stateTodo })
    store.openIssuePeek(issue.id)
    store.updateIssue(issue.id, { title: 'Still typing' })
    expect(store.ui.peekOpen).toBe(true)

    const outcome = store.sync.applyRemote({
      mutationId: 'remote-delete',
      revision: 99,
      issueId: issue.id,
      deleted: true,
    })
    expect(outcome).toBe('conflict')
    expect(store.issue(issue.id)).toBeUndefined()
    expect(store.ui.peekOpen).toBe(false)
    expect(store.ui.highlightedIssueId).toBeNull()
    expect(store.sync.statusForIssue(issue.id)).toBe('conflict')
  })
})
