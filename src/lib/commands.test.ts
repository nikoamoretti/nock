import { describe, expect, it } from 'vitest'
import { commandError } from './commands'

describe('commandError', () => {
  it('unwraps Error messages', () => {
    expect(commandError(new Error('disk full'))).toBe('disk full')
    expect(commandError('plain')).toBe('plain')
  })
})
