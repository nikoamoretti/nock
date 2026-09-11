import { describe, expect, it } from 'vitest'
import { formatIdentifier, parseIdentifier } from './identifiers'

describe('identifiers', () => {
  it('formats TEAM-number like Linear issue IDs', () => {
    expect(formatIdentifier('eng', 12)).toBe('ENG-12')
  })

  it('parses identifiers and rejects junk', () => {
    expect(parseIdentifier('eng-42')).toEqual({ teamKey: 'ENG', number: 42 })
    expect(parseIdentifier(' ENG-7 ')).toEqual({ teamKey: 'ENG', number: 7 })
    expect(parseIdentifier('not-an-id')).toBeNull()
    expect(parseIdentifier('ENG')).toBeNull()
  })
})
