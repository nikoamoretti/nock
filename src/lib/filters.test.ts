import { describe, expect, it } from 'vitest'
import { applyExtraFilters, filterIssues, fuzzyMatch, groupByState } from './filters'
import { createBootstrapSnapshot, IDS } from './seed'
import type { Issue } from './types'

function issue(
  patch: Partial<Issue> & Pick<Issue, 'id' | 'title' | 'stateId'>,
): Issue {
  return {
    teamId: IDS.teamEng,
    number: 1,
    identifier: 'ENG-1',
    description: '',
    priority: 0,
    assigneeId: null,
    projectId: null,
    cycleId: null,
    labelIds: [],
    parentId: null,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    syncId: 1,
    ...patch,
  }
}

describe('filters', () => {
  it('inbox only includes triage', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = [
      issue({
        id: 'a',
        title: 'Triage me',
        stateId: IDS.stateTriage,
        identifier: 'ENG-1',
        number: 1,
      }),
      issue({
        id: 'b',
        title: 'Todo',
        stateId: IDS.stateTodo,
        identifier: 'ENG-2',
        number: 2,
      }),
    ]
    const inbox = filterIssues(snapshot, 'inbox')
    expect(inbox.map((row) => row.id)).toEqual(['a'])
  })

  it('my issues are open issues assigned to the current user', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = [
      issue({
        id: 'mine',
        title: 'Mine',
        stateId: IDS.stateTodo,
        assigneeId: IDS.userMe,
      }),
      issue({
        id: 'done',
        title: 'Shipped',
        stateId: IDS.stateDone,
        assigneeId: IDS.userMe,
        identifier: 'ENG-2',
        number: 2,
      }),
      issue({
        id: 'maya',
        title: 'Maya',
        stateId: IDS.stateTodo,
        assigneeId: IDS.userMaya,
        identifier: 'ENG-3',
        number: 3,
      }),
    ]
    expect(filterIssues(snapshot, 'my-issues').map((row) => row.id)).toEqual([
      'mine',
    ])
  })

  it('groups issues by workflow state type order', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = [
      issue({
        id: 'done',
        title: 'Done',
        stateId: IDS.stateDone,
      }),
      issue({
        id: 'todo',
        title: 'Todo',
        stateId: IDS.stateTodo,
        identifier: 'ENG-2',
        number: 2,
      }),
    ]
    const groups = groupByState(snapshot.issues, snapshot.states)
    expect(groups.map((group) => group.state.name)).toEqual(['Todo', 'Done'])
  })

  it('board includes backlog through completed, not triage', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = [
      issue({
        id: 'triage',
        title: 'Triage',
        stateId: IDS.stateTriage,
      }),
      issue({
        id: 'backlog',
        title: 'Backlog',
        stateId: IDS.stateBacklog,
        identifier: 'ENG-2',
        number: 2,
      }),
      issue({
        id: 'todo',
        title: 'Todo',
        stateId: IDS.stateTodo,
        identifier: 'ENG-3',
        number: 3,
      }),
    ]
    expect(filterIssues(snapshot, 'board').map((row) => row.id)).toEqual([
      'backlog',
      'todo',
    ])
  })

  it('fuzzy-matches identifiers and subsequences', () => {
    expect(fuzzyMatch('eng-1', 'ENG-12 IndexedDB')).toBe(true)
    expect(fuzzyMatch('idb', 'IndexedDB bootstrap')).toBe(true)
    expect(fuzzyMatch('zzz', 'IndexedDB bootstrap')).toBe(false)
  })

  it('all issues exclude triage', () => {
    const snapshot = createBootstrapSnapshot({ demo: false })
    snapshot.issues = [
      issue({
        id: 'triage',
        title: 'Triage',
        stateId: IDS.stateTriage,
      }),
      issue({
        id: 'todo',
        title: 'Todo',
        stateId: IDS.stateTodo,
        identifier: 'ENG-2',
        number: 2,
      }),
    ]
    expect(filterIssues(snapshot, 'all').map((row) => row.id)).toEqual(['todo'])
  })

  it('extra filters narrow a view', () => {
    const rows = [
      issue({
        id: 'mine',
        title: 'Mine',
        stateId: IDS.stateTodo,
        assigneeId: IDS.userMe,
        priority: 1,
      }),
      issue({
        id: 'maya',
        title: 'Maya',
        stateId: IDS.stateTodo,
        assigneeId: IDS.userMaya,
        identifier: 'ENG-2',
        number: 2,
        priority: 4,
      }),
    ]
    expect(
      applyExtraFilters(rows, {
        assigneeId: IDS.userMe,
        stateId: null,
        priority: 1,
        projectId: null,
        cycleId: null,
      }).map((row) => row.id),
    ).toEqual(['mine'])
  })
})
