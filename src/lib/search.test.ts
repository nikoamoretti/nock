import { describe, expect, it } from 'vitest'
import { flattenSearchResults, type SearchDocument } from './search'

describe('search display order', () => {
  it('flattens groups as issues, projects, then documents', () => {
    const rows: SearchDocument[] = [
      { id: 'd', type: 'document', title: 'Doc', body: '', updatedAt: 3 },
      { id: 'i', type: 'issue', title: 'Issue', body: '', updatedAt: 1 },
      { id: 'p', type: 'project', title: 'Project', body: '', updatedAt: 2 },
    ]
    expect(flattenSearchResults(rows).map((row) => row.type)).toEqual([
      'issue',
      'project',
      'document',
    ])
  })
})
