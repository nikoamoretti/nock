/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createBootstrapSnapshot, IDS } from '../seed'
import { NockStore } from '../store'

function key(
  init: KeyboardEventInit,
  target?: EventTarget | null,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  if (target) Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('ShortcutManager and focus', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not run letter shortcuts while typing unless intended', () => {
    const nock = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    nock.commands.handleKey(key({ key: 'c' }, input))
    expect(nock.ui.composerOpen).toBe(false)
    nock.commands.handleKey(key({ key: 'p' }, input))
    expect(nock.ui.propertyMenu).toBeNull()
    nock.commands.handleKey(key({ key: 'k', metaKey: true }, input))
    expect(nock.ui.commandOpen).toBe(true)
    nock.commands.handleKey(key({ key: 'Escape' }, input))
    expect(nock.ui.commandOpen).toBe(false)
  })

  it('returns focus to the origin after a capturing overlay closes', () => {
    const nock = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const origin = document.createElement('button')
    origin.textContent = 'Origin'
    document.body.append(origin)
    origin.focus()
    expect(document.activeElement).toBe(origin)
    nock.commands.run('command.palette')
    expect(nock.ui.commandOpen).toBe(true)
    expect(nock.commands.focusOrigin).toBe(origin)
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    expect(document.activeElement).toBe(field)
    nock.commands.run('surface.dismiss')
    expect(nock.ui.commandOpen).toBe(false)
    expect(document.activeElement).toBe(origin)
  })

  it('Escape follows the modal stack from the keyboard', () => {
    const nock = NockStore.from(createBootstrapSnapshot({ demo: false }))
    nock.commands.run('issue.create')
    nock.commands.run('issue.setPriority')
    nock.commands.handleKey(key({ key: 'Escape' }))
    expect(nock.ui.propertyMenu).toBeNull()
    expect(nock.ui.composerOpen).toBe(true)
    nock.commands.handleKey(key({ key: 'Escape' }))
    expect(nock.ui.composerOpen).toBe(false)
  })

  it('X toggles the highlighted issue when not typing', () => {
    const nock = NockStore.from(createBootstrapSnapshot({ demo: false }))
    const issue = nock.createIssue({ title: 'Row', stateId: IDS.stateTodo })
    nock.highlightIssue(issue.id)
    nock.commands.handleKey(key({ key: 'x' }))
    expect(nock.ui.selectedIssueIds).toEqual([issue.id])
    nock.commands.handleKey(key({ key: 'x' }))
    expect(nock.ui.selectedIssueIds).toEqual([])
  })
})
