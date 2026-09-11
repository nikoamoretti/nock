import { describe, expect, it } from 'vitest'
import { createBootstrapSnapshot, IDS } from '../seed'
import { NockStore } from '../store'
import { formatShortcut } from './platform'

function store() {
  return NockStore.from(createBootstrapSnapshot({ demo: false }))
}

describe('CommandRegistry', () => {
  it('keeps issue mutations unavailable in invalid contexts', () => {
    const nock = store()
    const commands = nock.commands
    expect(commands.canRun('issue.create')).toBe(true)
    expect(commands.canRun('issue.setStatus')).toBe(false)
    expect(commands.canRun('issue.setPriority')).toBe(false)
    expect(commands.canRun('issue.delete')).toBe(false)
    expect(commands.canRun('issue.moveTeam')).toBe(false)
    expect(commands.canRun('issue.relate')).toBe(false)
    expect(commands.canRun('issue.block')).toBe(false)
    expect(commands.canRun('issue.markDuplicate')).toBe(false)
    expect(commands.canRun('issue.subscribe')).toBe(false)
    expect(commands.paletteItems().map((command) => command.id)).not.toContain(
      'issue.delete',
    )
    expect(commands.paletteItems().map((command) => command.id)).not.toContain(
      'issue.moveTeam',
    )

    const issue = nock.createIssue({ title: 'Ready', stateId: IDS.stateTodo })
    nock.highlightIssue(issue.id)
    expect(commands.canRun('issue.setStatus')).toBe(true)
    expect(commands.canRun('issue.setPriority')).toBe(true)
    expect(commands.canRun('issue.delete')).toBe(true)
    expect(commands.canRun('issue.moveTeam')).toBe(false)
    expect(commands.canRun('issue.subscribe')).toBe(false)
    expect(commands.canRun('issue.unsubscribe')).toBe(true)
    expect(commands.paletteItems().map((command) => command.id)).toContain(
      'issue.delete',
    )
    expect(commands.paletteItems().map((command) => command.id)).not.toContain(
      'issue.moveTeam',
    )
  })

  it('applies a bulk command once to the complete selection', () => {
    const nock = store()
    const a = nock.createIssue({ title: 'A', stateId: IDS.stateTodo, priority: 0 })
    const b = nock.createIssue({ title: 'B', stateId: IDS.stateTodo, priority: 4 })
    nock.clickIssue(a.id)
    nock.commands.run('selection.toggle', { id: b.id })
    expect(nock.ui.selectedIssueIds).toEqual([a.id, b.id])
    const before = nock.commands.undo.depth
    const result = nock.commands.run('issue.setPriority', { priority: 1 })
    expect(result.ok).toBe(true)
    expect(nock.issue(a.id)?.priority).toBe(1)
    expect(nock.issue(b.id)?.priority).toBe(1)
    expect(nock.commands.undo.depth).toBe(before + 1)
    const entry = nock.commands.undo.peek()
    expect(entry?.inverse).toEqual([
      {
        type: 'issue.patch',
        patches: [
          { id: a.id, patch: { priority: 0 } },
          { id: b.id, patch: { priority: 4 } },
        ],
      },
    ])
  })

  it('records inverse actions that restore prior issue state', () => {
    const nock = store()
    const created = nock.commands.run('issue.create', { title: 'Undo me' })
    expect(created.ok).toBe(true)
    if (!created.ok || !created.issueId) throw new Error('expected create')
    expect(nock.commands.undo.peek()?.inverse).toEqual([
      { type: 'issue.delete', ids: [created.issueId] },
    ])
    nock.commands.run('edit.undo')
    expect(nock.issue(created.issueId)).toBeUndefined()

    const issue = nock.createIssue({ title: 'Keep', stateId: IDS.stateTodo })
    nock.highlightIssue(issue.id)
    nock.commands.run('issue.archive')
    expect(nock.issue(issue.id)?.archivedAt).toBeTruthy()
    const archiveInverse = nock.commands.undo.peek()?.inverse[0]
    expect(archiveInverse?.type).toBe('issue.patch')
    nock.commands.run('edit.undo')
    expect(nock.issue(issue.id)?.archivedAt).toBeNull()

    nock.highlightIssue(issue.id)
    nock.commands.run('issue.delete')
    expect(nock.issue(issue.id)).toBeUndefined()
    expect(nock.commands.undo.peek()?.inverse[0]?.type).toBe('issue.restore')
    nock.commands.run('edit.undo')
    expect(nock.issue(issue.id)?.title).toBe('Keep')
  })

  it('closes overlays in modal-stack order', () => {
    const nock = store()
    nock.commands.run('issue.create')
    expect(nock.ui.composerOpen).toBe(true)
    nock.commands.run('issue.setPriority')
    expect(nock.ui.propertyMenu).toBe('priority')
    expect(nock.ui.modalStack).toEqual(['composer', 'property'])
    nock.commands.run('surface.dismiss')
    expect(nock.ui.propertyMenu).toBeNull()
    expect(nock.ui.composerOpen).toBe(true)
    nock.commands.run('surface.dismiss')
    expect(nock.ui.composerOpen).toBe(false)
    const issue = nock.createIssue({ title: 'Row', stateId: IDS.stateTodo })
    nock.highlightIssue(issue.id)
    nock.commands.run('selection.toggle')
    nock.commands.run('issue.open')
    expect(nock.ui.peekOpen).toBe(true)
    nock.commands.run('surface.dismiss')
    expect(nock.ui.peekOpen).toBe(false)
    expect(nock.ui.selectedIssueIds).toEqual([issue.id])
    nock.commands.run('surface.dismiss')
    expect(nock.ui.selectedIssueIds).toEqual([])
    expect(nock.ui.highlightedIssueId).toBe(issue.id)
  })

  it('selects every visible matching issue once', () => {
    const nock = store()
    nock.createIssue({ title: 'One', stateId: IDS.stateTodo })
    nock.createIssue({ title: 'Two', stateId: IDS.stateTodo })
    nock.setFilter('priority', 1)
    nock.createIssue({ title: 'Urgent', stateId: IDS.stateTodo, priority: 1 })
    nock.commands.setHost({ view: 'all' })
    nock.commands.run('selection.all')
    expect(nock.ui.selectedIssueIds).toEqual(
      nock.issuesForView('all').map((issue) => issue.id),
    )
    expect(nock.ui.selectedIssueIds).toHaveLength(1)
  })

  it('relates, blocks, and marks duplicates across the selection', () => {
    const nock = store()
    const a = nock.createIssue({ title: 'Canonical', stateId: IDS.stateTodo })
    const b = nock.createIssue({ title: 'Other', stateId: IDS.stateTodo })
    nock.clickIssue(a.id)
    nock.commands.run('selection.toggle', { id: b.id })
    expect(nock.commands.run('issue.relate').ok).toBe(true)
    expect(nock.issue(a.id)?.relatedIssueIds).toContain(b.id)
    expect(nock.issue(b.id)?.relatedIssueIds).toContain(a.id)
    expect(nock.commands.run('issue.block').ok).toBe(true)
    expect(nock.issue(b.id)?.blockedByIds).toContain(a.id)
    expect(nock.commands.run('issue.markDuplicate').ok).toBe(true)
    expect(nock.issue(b.id)?.duplicateOfId).toBe(a.id)
    expect(nock.issue(b.id)?.stateId).toBe(IDS.stateDuplicate)
  })
})

describe('platform shortcut labels', () => {
  it('uses Cmd on Apple and Ctrl elsewhere', () => {
    expect(formatShortcut({ key: 'k', mod: true }, true)).toBe('⌘K')
    expect(formatShortcut({ key: 'p', shift: true }, true)).toBe('⇧P')
    expect(formatShortcut({ key: 'k', mod: true }, false)).toBe('Ctrl+K')
    expect(formatShortcut({ key: 'p', shift: true }, false)).toBe('Shift+P')
  })
})
