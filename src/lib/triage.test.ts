import { describe, expect, it } from 'vitest'
import { createBootstrapSnapshot, IDS } from './seed'
import { NockStore } from './store'
import { applyTriageRules, mergeSupportLinks, type TriageRule } from './triage'

describe('triage', () => {
  it('runs a 100-item session without leaving the queue', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const ids: string[] = []
    for (let index = 0; index < 100; index += 1) {
      const issue = store.createIssue({
        title: `Triage ${index}`,
        stateId: IDS.stateTriage,
      })
      ids.push(issue.id)
    }
    store.highlightIssue(ids[0]!)
    for (let index = 0; index < 100; index += 1) {
      const before = store.issuesForView('inbox').length
      store.acceptTriage()
      expect(store.issuesForView('inbox').length).toBe(before - 1)
      if (index < 99) expect(store.ui.highlightedIssueId).toBeTruthy()
    }
    expect(store.issuesForView('inbox')).toHaveLength(0)
    expect(store.issue(ids[0]!)?.stateId).toBe(IDS.stateTodo)
  })

  it('snoozes, duplicates with support-link merge, and applies ordered rules', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const canonical = store.createIssue({ title: 'Canonical', stateId: IDS.stateTodo })
    const incoming = store.createIssue({
      title: 'Dup incoming',
      stateId: IDS.stateTriage,
      labelIds: [IDS.labelBug],
    })
    store.addLink(incoming.id, 'https://support.test/1', 'Ticket')
    store.customerRequests.set('req_1', {
      id: 'req_1',
      customerId: 'cust_1',
      issueId: incoming.id,
      body: 'Please help',
      createdAt: Date.now(),
    })
    store.highlightIssue(incoming.id)
    store.snoozeTriage(2)
    expect(store.issuesForView('inbox').map((issue) => issue.id)).not.toContain(incoming.id)
    store.snoozes.delete(incoming.id)
    store.highlightIssue(incoming.id)
    store.duplicateTriage(canonical.id)
    expect(store.issue(incoming.id)?.duplicateOfId).toBe(canonical.id)
    expect(store.linksForIssue(canonical.id).some((link) => link.url === 'https://support.test/1')).toBe(
      true,
    )
    expect(store.customerRequests.get('req_1')?.issueId).toBe(canonical.id)

    const rule: TriageRule = {
      id: 'bugs-to-jules',
      name: 'Bugs to Jules',
      enabled: true,
      conditions: [{ field: 'label', value: IDS.labelBug }],
      actions: [{ field: 'assignee', value: IDS.userJules }],
    }
    const bug = store.createIssue({
      title: 'Ruled',
      stateId: IDS.stateTriage,
      labelIds: [IDS.labelBug],
    })
    expect(applyTriageRules(bug, [rule]).assigneeId).toBe(IDS.userJules)
    store.triageRules = [rule]
    store.highlightIssue(bug.id)
    store.acceptTriage()
    expect(store.issue(bug.id)?.assigneeId).toBe(IDS.userJules)
    expect(store.issue(bug.id)?.stateId).toBe(IDS.stateTodo)

    const merged = mergeSupportLinks({
      fromId: 'a',
      intoId: 'b',
      links: [{ id: 'l', issueId: 'a', url: 'https://x', title: 'x' }],
      requests: [{ id: 'r', customerId: 'c', issueId: 'a', body: 'hi', createdAt: 1 }],
    })
    expect(merged.links[0]?.issueId).toBe('b')
    expect(merged.requests[0]?.issueId).toBe('b')
  })

  it('undoes snooze and restores the issue to the queue', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.commands.setHost({ view: 'inbox' })
    const incoming = store.createIssue({ title: 'Snooze me', stateId: IDS.stateTriage })
    store.highlightIssue(incoming.id)
    expect(store.commands.run('issue.snoozeTriage').ok).toBe(true)
    expect(store.issuesForView('inbox').map((issue) => issue.id)).not.toContain(incoming.id)
    store.commands.run('edit.undo')
    expect(store.issuesForView('inbox').map((issue) => issue.id)).toContain(incoming.id)
  })
})
