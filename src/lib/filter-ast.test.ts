import { describe, expect, it } from 'vitest'
import {
  addCondition,
  astFromFilters,
  combineFilterRoot,
  fieldIsMixed,
  filterAstActive,
  filtersFromAst,
  hasClause,
  matchFilterAst,
  setFieldValue,
  toggleCondition,
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

  it('keeps a label when a priority is added', () => {
    const labeled = addCondition(
      { type: 'all' },
      { field: 'labelId', op: 'eq', value: IDS.labelBug },
    )
    const next = setFieldValue(labeled, 'priority', 1)
    expect(matchFilterAst(
      issue({
        id: 'a',
        title: 'Both',
        labelIds: [IDS.labelBug],
        priority: 1,
      }),
      next,
    )).toBe(true)
    expect(matchFilterAst(
      issue({
        id: 'b',
        title: 'Label only',
        labelIds: [IDS.labelBug],
        priority: 0,
      }),
      next,
    )).toBe(false)
    expect(hasClause(next, 'labelId', IDS.labelBug)).toBe(true)
  })

  it('deselects one label without dropping the other', () => {
    let ast = toggleCondition({ type: 'all' }, 'labelId', IDS.labelBug)
    ast = toggleCondition(ast, 'labelId', IDS.labelFeature)
    ast = toggleCondition(ast, 'labelId', IDS.labelBug)
    expect(hasClause(ast, 'labelId', IDS.labelBug)).toBe(false)
    expect(hasClause(ast, 'labelId', IDS.labelFeature)).toBe(true)
  })

  it('preserves a nested imported expression when adding an assignee', () => {
    const imported: import('./types').FilterAst = {
      type: 'and',
      nodes: [
        {
          type: 'or',
          nodes: [
            { type: 'clause', clause: { field: 'stateId', op: 'eq', value: IDS.stateTodo } },
            {
              type: 'clause',
              clause: { field: 'stateId', op: 'eq', value: IDS.stateProgress },
            },
          ],
        },
        {
          type: 'clause',
          clause: { field: 'projectId', op: 'neq', value: IDS.projectCommand },
        },
      ],
    }
    expect(fieldIsMixed(imported, 'stateId')).toBe(true)
    const next = addCondition(imported, {
      field: 'assigneeId',
      op: 'eq',
      value: IDS.userMe,
    })
    expect(JSON.stringify(next)).toContain('"op":"neq"')
    expect(hasClause(next, 'stateId', IDS.stateTodo)).toBe(true)
    expect(hasClause(next, 'stateId', IDS.stateProgress)).toBe(true)
    expect(hasClause(next, 'assigneeId', IDS.userMe)).toBe(true)
    expect(
      matchFilterAst(
        issue({
          id: 'keep',
          title: 'Keep',
          stateId: IDS.stateTodo,
          assigneeId: IDS.userMe,
          projectId: IDS.projectSync,
        }),
        next,
      ),
    ).toBe(true)
    expect(
      matchFilterAst(
        issue({
          id: 'drop',
          title: 'Wrong project',
          stateId: IDS.stateTodo,
          assigneeId: IDS.userMe,
          projectId: IDS.projectCommand,
        }),
        next,
      ),
    ).toBe(false)
  })

  it('treats label-only and negative-only expressions as active', () => {
    const labels = addCondition(
      { type: 'all' },
      { field: 'labelId', op: 'eq', value: IDS.labelBug },
    )
    const negative = addCondition(
      { type: 'all' },
      { field: 'projectId', op: 'neq', value: IDS.projectCommand },
    )
    expect(filterAstActive(labels)).toBe(true)
    expect(filterAstActive(negative)).toBe(true)
    expect(filtersFromAst(labels).assigneeId).toBeNull()
    expect(filtersFromAst(negative).projectId).toBeNull()
  })

  it('keeps an OR preference wrapper when the first condition is added', () => {
    const next = addCondition(
      { type: 'all' },
      { field: 'priority', op: 'eq', value: 1 },
      'or',
    )
    expect(next).toEqual({
      type: 'or',
      nodes: [{ type: 'clause', clause: { field: 'priority', op: 'eq', value: 1 } }],
    })
  })
})
