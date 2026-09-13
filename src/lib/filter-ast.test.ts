import { describe, expect, it } from 'vitest'
import {
  astFromFilters,
  combineFilterRoot,
  filtersFromAst,
  matchFilterAst,
} from './filter-ast'
import { IDS } from './seed'
import { EMPTY_FILTERS, type Issue } from './types'

function issue(patch: Partial<Issue> & Pick<Issue, 'id' | 'title'>): Issue {
  return {
    teamId: IDS.teamEng,
    number: 1,
    identifier: 'ENG-1',
    description: '',
    priority: 0,
    stateId: IDS.stateTodo,
    assigneeId: null,
    projectId: null,
    cycleId: null,
    labelIds: [],
    parentId: null,
    milestoneId: null,
    subscriberIds: [],
    relatedIssueIds: [],
    blockedByIds: [],
    duplicateOfId: null,
    archivedAt: null,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    syncId: 1,
    revision: 1,
    lastMutationId: null,
    ...patch,
  }
}

describe('filter AST', () => {
  it('round-trips simple filters', () => {
    const filters = {
      ...EMPTY_FILTERS,
      assigneeId: IDS.userMe,
      priority: 1 as const,
    }
    const ast = astFromFilters(filters)
    expect(ast.type).toBe('and')
    expect(filtersFromAst(ast)).toEqual(filters)
  })

  it('matches OR nodes', () => {
    const mine = issue({ id: 'a', title: 'Mine', assigneeId: IDS.userMe })
    const maya = issue({
      id: 'b',
      title: 'Maya',
      assigneeId: IDS.userMaya,
      identifier: 'ENG-2',
      number: 2,
    })
    const ast = {
      type: 'or' as const,
      nodes: [
        astFromFilters({ ...EMPTY_FILTERS, assigneeId: IDS.userMe }),
        astFromFilters({ ...EMPTY_FILTERS, assigneeId: IDS.userMaya }),
      ],
    }
    expect(matchFilterAst(mine, ast)).toBe(true)
    expect(matchFilterAst(maya, ast)).toBe(true)
    expect(
      matchFilterAst(
        issue({ id: 'c', title: 'Other', assigneeId: IDS.userJules }),
        ast,
      ),
    ).toBe(false)
  })

  it('switches a clause group between AND and OR', () => {
    const andAst = astFromFilters({
      ...EMPTY_FILTERS,
      assigneeId: IDS.userMe,
      priority: 1,
    })
    expect(andAst.type).toBe('and')
    const orAst = combineFilterRoot(andAst, 'or')
    expect(orAst.type).toBe('or')
    expect(filtersFromAst(orAst)).toEqual(filtersFromAst(andAst))
  })
})
