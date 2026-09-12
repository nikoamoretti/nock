import { describe, expect, it } from 'vitest'
import {
  collectionPath,
  identifierFromPath,
  issueFullPath,
  issuePeekPath,
} from './paths'

describe('issue paths', () => {
  it('builds collection, peek, and full routes', () => {
    expect(collectionPath('all')).toBe('/eng/all')
    expect(issuePeekPath('all', 'ENG-12')).toBe('/eng/all/ENG-12')
    expect(issueFullPath('ENG-12')).toBe('/issues/ENG-12')
    expect(identifierFromPath('/eng/all/ENG-12')).toBe('ENG-12')
    expect(identifierFromPath('/issues/ENG-12')).toBe('ENG-12')
  })
})
