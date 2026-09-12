import { describe, expect, it } from 'vitest'
import { MemoryPersistence, type Persistence } from './persist'
import { createBootstrapSnapshot, IDS } from './seed'
import { githubCommands } from './integrations'
import { NockStore } from './store'
import { ImmediateAckBackend } from './sync/backend'
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
  it('mints ENG-N identifiers and increments lastSyncId', async () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const first = store.createIssue({ title: 'First' })
    const second = store.createIssue({ title: 'Second' })
    expect(first.identifier).toBe('ENG-1')
    expect(second.identifier).toBe('ENG-2')
    await store.flushSync()
    expect(store.issue(second.id)!.revision).toBeGreaterThan(
      store.issue(first.id)!.revision,
    )
    expect(store.lastSyncId).toBe(store.issue(second.id)!.syncId)
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

  it('keeps the higher syncId on conflicting writes', async () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const created = store.createIssue({ title: 'Local' })
    await store.flushSync()
    const issue = store.issue(created.id)!
    store.applyRemoteIssue({
      ...issue,
      title: 'Stale replica',
      syncId: issue.syncId - 1,
      revision: issue.revision - 1,
    })
    expect(store.issue(issue.id)?.title).toBe('Local')
    store.applyRemoteIssue({
      ...issue,
      title: 'fresher replica',
      syncId: issue.syncId + 4,
      revision: issue.revision + 4,
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
    expect(store.issues.size).toBeGreaterThan(0)
    const nextNumber = store.defaultTeam().issueCounter + 1
    store.createIssue({ title: 'Persisted', stateId: IDS.stateTodo })
    await store.flushSync()
    const again = await NockStore.open(persist)
    expect(again.issueByIdentifier(`ENG-${nextNumber}`)?.title).toBe('Persisted')
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
    const fromView = store.issuesForView('all').find((row) => row.id === urgent.id)
    expect(fromView).toBe(store.issue(urgent.id))
    expect(store.issuesForView('all').map((row) => row.id)).toEqual([urgent.id])
    expect(store.issueIdsForView('all')).toEqual([urgent.id])
    expect(store.viewQuery('all')).toEqual({
      view: 'all',
      filters: store.ui.filters,
    })
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

  it('routes issue mutations through execute', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const created = store.execute({
      type: 'issue.create',
      input: { title: 'Via command', stateId: IDS.stateTodo },
    })
    expect(created.ok).toBe(true)
    if (!created.ok || !created.issueId) throw new Error('expected create')
    const issueId = created.issueId
    expect(store.issue(issueId)?.title).toBe('Via command')

    store.highlightIssue(issueId)
    expect(
      store.execute({ type: 'issue.setProperty', kind: 'priority', value: 1 }).ok,
    ).toBe(true)
    expect(store.issue(issueId)?.priority).toBe(1)

    expect(
      store.execute({
        type: 'issue.moveToState',
        id: issueId,
        stateId: IDS.stateProgress,
      }).ok,
    ).toBe(true)
    expect(store.issue(issueId)?.stateId).toBe(IDS.stateProgress)

    expect(
      store.execute({
        type: 'issue.update',
        id: issueId,
        patch: { title: 'Renamed' },
      }).ok,
    ).toBe(true)
    expect(store.issue(issueId)?.title).toBe('Renamed')

    expect(store.execute({ type: 'issue.create', input: { title: '  ' } }).ok).toBe(
      false,
    )
  })

  it('accepts triage through the same command as the inbox buttons', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const incoming = store.createIssue({
      title: 'Incoming',
      stateId: IDS.stateTriage,
    })
    store.highlightIssue(incoming.id)
    expect(
      store.execute({ type: 'issue.acceptTriage', view: 'inbox' }).ok,
    ).toBe(true)
    expect(store.issue(incoming.id)?.stateId).toBe(IDS.stateTodo)
  })

  it('moves a highlighted board card with the keyboard command', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const issue = store.createIssue({
      title: 'Card',
      stateId: IDS.stateTodo,
    })
    store.highlightIssue(issue.id)
    expect(store.moveHighlightedAlongBoard(1).ok).toBe(true)
    expect(store.issue(issue.id)?.stateId).toBe(IDS.stateProgress)
    expect(store.moveHighlightedAlongBoard(-1).ok).toBe(true)
    expect(store.issue(issue.id)?.stateId).toBe(IDS.stateTodo)
  })

  it('surfaces persist failure and reconciles on retry', async () => {
    const persist = new FailThenSavePersistence()
    const store = NockStore.from(
      createBootstrapSnapshot({ demo: false }),
      persist,
      { online: false },
    )
    store.execute({
      type: 'issue.create',
      input: { title: 'Keep me', stateId: IDS.stateTodo },
    })
    await store.flush()
    expect(store.persistError).toBe('disk full')
    expect(persist.snapshot).toBeNull()
    expect(store.issueByIdentifier('ENG-1')?.title).toBe('Keep me')
    store.retryPersist()
    await store.flush()
    expect(store.persistError).toBeNull()
    expect(persist.snapshot?.issues.some((row) => row.title === 'Keep me')).toBe(
      true,
    )
  })

  it('saves and reapplies a view including filter AST', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.setFilter('assigneeId', IDS.userMe)
    store.setGroupBy('priority')
    store.setSubgroupBy('assignee')
    store.setOrderBy('updated')
    const saved = store.saveView('Mine', 'all')
    store.clearFilters()
    store.setFilter('priority', 1)
    expect(store.ui.filters.assigneeId).toBe(null)
    store.applySavedView(saved.id)
    expect(store.ui.filters.assigneeId).toBe(IDS.userMe)
    expect(store.ui.groupBy).toBe('priority')
    expect(store.ui.subgroupBy).toBe('assignee')
    expect(store.ui.orderBy).toBe('updated')
    expect(store.ui.savedViewId).toBe(saved.id)
  })

  it('drops a card onto another column and rolls back a rejected drop', async () => {
    const backend = new ImmediateAckBackend()
    const store = NockStore.from(
      createBootstrapSnapshot({ demo: false }),
      new MemoryPersistence(),
      { backend },
    )
    const issue = store.createIssue({ title: 'Card', stateId: IDS.stateTodo })
    await store.flushSync()
    store.dropIssuesOnColumn(IDS.stateProgress, [issue.id], 0)
    expect(store.issue(issue.id)?.stateId).toBe(IDS.stateProgress)
    await store.flushSync()

    const other = store.createIssue({ title: 'Rollback', stateId: IDS.stateTodo })
    await store.flushSync()
    backend.rejectIds.add(other.id)
    store.dropIssuesOnColumn(IDS.stateProgress, [other.id], 0)
    await store.flushSync()
    expect(store.issue(other.id)?.stateId).toBe(IDS.stateTodo)
  })

  it('records comments, activity, and links on an issue', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const issue = store.createIssue({ title: 'Talk', stateId: IDS.stateTodo })
    store.addComment(issue.id, 'Looks good')
    store.addLink(issue.id, 'https://example.test', 'Spec')
    expect(store.commentsForIssue(issue.id)[0]?.body).toBe('Looks good')
    expect(store.activitiesForIssue(issue.id)[0]?.body).toContain('Commented')
    expect(store.linksForIssue(issue.id)[0]?.url).toBe('https://example.test')
  })

  it('rolls ended cycles and keeps project date edits local', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false, now: Date.parse('2026-09-11T12:00:00Z') }))
    const ended = [...store.cycles.values()].find((cycle) => cycle.number === 11)!
    store.cycles.set(ended.id, { ...ended, completedAt: null, endsAt: Date.now() - 1000 })
    const leftover = store.createIssue({
      title: 'Did not ship',
      stateId: IDS.stateTodo,
      cycleId: ended.id,
    })
    store.rolloverEndedCycles(Date.now())
    expect(store.cycles.get(ended.id)?.completedAt).not.toBeNull()
    expect(store.issue(leftover.id)?.cycleId).not.toBe(ended.id)
    const project = [...store.projects.values()][0]!
    const nextStart = (project.startAt ?? Date.now()) + 86400000
    const nextEnd = (project.targetAt ?? Date.now()) + 86400000
    store.setProjectDates(project.id, nextStart, nextEnd)
    expect(store.projects.get(project.id)?.startAt).toBe(nextStart)
  })

  it('splits seeded notifications and archives the highlighted row', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    expect(store.notifications.size).toBeGreaterThan(0)
    store.setInboxPane('priority')
    const priority = store.inboxNotifications('priority')
    expect(priority.length).toBeGreaterThan(0)
    store.highlightNotification(priority[0]!.id)
    store.archiveInbox(priority[0]!.id)
    expect(store.inboxNotifications('priority').map((row) => row.id)).not.toContain(priority[0]!.id)
    store.setDeliveryPreference('mention', false)
    expect(store.inboxDelivery.mention).toBe(false)
  })

  it('applies GitHub integration commands onto ExternalLink, not Issue columns', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: true }))
    const issue = store.issueByIdentifier('ENG-1')
    expect(issue).toBeTruthy()
    expect('githubPrUrl' in (issue ?? {})).toBe(false)
    store.applyIntegrationCommands(
      githubCommands('pull_request', {
        action: 'opened',
        pull_request: {
          number: 3,
          title: 'ENG-1 from PR',
          html_url: 'https://github.com/acme/nock/pull/3',
          merged: false,
          head: { ref: 'eng-1-pr' },
        },
      }),
    )
    expect(store.externalLinksForIssue(issue!.id).some((row) => row.url.includes('/pull/3'))).toBe(true)
    expect(store.installations.get('inst_github')?.provider).toBe('github')
  })
})

class FailThenSavePersistence implements Persistence {
  snapshot: Snapshot | null = null
  remainingFails = 1

  async load(): Promise<Snapshot | null> {
    return this.snapshot
  }

  async save(snapshot: Snapshot): Promise<void> {
    if (this.remainingFails > 0) {
      this.remainingFails -= 1
      throw new Error('disk full')
    }
    this.snapshot = structuredClone(snapshot)
  }
}
