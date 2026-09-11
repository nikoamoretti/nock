import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_TOKENS } from './tokens'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'),
  'utf8',
)

describe('design tokens', () => {
  it('declares every semantic token in CSS', () => {
    for (const token of ALL_TOKENS) {
      expect(css, token).toContain(`--${token}:`)
    }
  })

  it('defines both dark and light themes', () => {
    expect(css).toContain("[data-theme='dark']")
    expect(css).toContain("[data-theme='light']")
    expect(css).toContain('prefers-reduced-motion')
  })
})
