/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Button, IconButton } from './button'

afterEach(cleanup)

describe('Button', () => {
  it('exposes disabled and loading states to assistive tech', () => {
    render(<Button loading>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('requires an accessible name on icon buttons', async () => {
    const user = userEvent.setup()
    let clicked = false
    render(
      <IconButton
        label="Close"
        onClick={() => {
          clicked = true
        }}
      >
        ×
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Close' })
    await user.click(button)
    expect(clicked).toBe(true)
  })
})
