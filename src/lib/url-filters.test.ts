import { describe, expect, it } from 'vitest'
import { astFromFilters } from './filter-ast'
import { FILTER_UNASSIGNED, type FilterAst } from './types'
import {
  astFromSearch,
  decodeFilterAst,
  encodeFilterAst,
  filtersFromSearch,
  searchFromAst,
  searchFromFilters,
} from './url-filters'

describe('url filters', () => {
  it('round-trips assignee, status, and priority', () => {
    const search = searchFromFilters({
      assigneeId: 'user_me',
      stateId: 'state_todo',
      priority: 1,
      projectId: null,
      cycleId: null,
    })
    expect(search).toBe('?assignee=user_me&status=state_todo&priority=1')
    expect(filtersFromSearch(search)).toEqual({
      assigneeId: 'user_me',
      stateId: 'state_todo',
      priority: 1,
      projectId: null,
      cycleId: null,
    })
  })

  it('encodes unassigned as none', () => {
    const search = searchFromFilters({
      assigneeId: FILTER_UNASSIGNED,
      stateId: null,
      priority: null,
      projectId: null,
      cycleId: null,
    })
    expect(search).toBe('?assignee=none')
    expect(filtersFromSearch(search).assigneeId).toBe(FILTER_UNASSIGNED)
  })

  it('treats an empty search as no filters', () => {
    expect(filtersFromSearch('')).toEqual({
      assigneeId: null,
      stateId: null,
      priority: null,
      projectId: null,
      cycleId: null,
    })
  })

  it('round-trips nested filter AST through the query string', () => {
    const ast: FilterAst = {
      type: 'or',
      nodes: [
        astFromFilters({
          assigneeId: 'user_me',
          stateId: null,
          priority: null,
          projectId: null,
          cycleId: null,
        }),
        astFromFilters({
          assigneeId: null,
          stateId: null,
          priority: 1,
          projectId: null,
          cycleId: null,
        }),
      ],
    }
    const encoded = encodeFilterAst(ast)
    expect(decodeFilterAst(encoded)).toEqual(ast)
    const search = searchFromAst(ast)
    expect(astFromSearch(search)).toEqual(ast)
    expect(search).toContain('filter=')
  })
})
