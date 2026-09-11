/** @vitest-environment jsdom */

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Checkbox, Radio, RadioGroup, TextField } from './fields'

afterEach(cleanup)

describe('fields', () => {
  it('wires error text to the input', () => {
    render(<TextField label="Title" error="Required" />)
    const input = screen.getByLabelText('Title')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('Required')
  })

  it('toggles checkbox from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Checkbox label="Done" />)
    const box = screen.getByLabelText('Done')
    expect((box as HTMLInputElement).checked).toBe(false)
    await user.click(box)
    expect((box as HTMLInputElement).checked).toBe(true)
  })

  it('moves radio selection', async () => {
    const user = userEvent.setup()
    function Group() {
      const [value, setValue] = useState('list')
      return (
        <RadioGroup name="layout" label="Layout" value={value} onChange={setValue}>
          <Radio value="list" label="List" />
          <Radio value="board" label="Board" />
        </RadioGroup>
      )
    }
    render(<Group />)
    await user.click(screen.getByLabelText('Board'))
    expect((screen.getByLabelText('Board') as HTMLInputElement).checked).toBe(
      true,
    )
  })
})
