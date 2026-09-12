import { describe, expect, it } from 'vitest'
import { LIST_ROW_HEIGHT, visibleRange } from './virtualize'

describe('visibleRange', () => {
  it('keeps list rows in the 32–36px band', () => {
    expect(LIST_ROW_HEIGHT).toBeGreaterThanOrEqual(32)
    expect(LIST_ROW_HEIGHT).toBeLessThanOrEqual(36)
  })

  it('windows a long list with overscan', () => {
    const range = visibleRange(200, 340, 200, 34, 2)
    expect(range.start).toBe(8)
    expect(range.end).toBeLessThan(200)
    expect(range.offset).toBe(range.start * 34)
    expect(range.height).toBe(200 * 34)
  })
})
