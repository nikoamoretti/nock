/** @vitest-environment jsdom */

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Dialog, DropdownMenu } from './overlays'

afterEach(cleanup)

describe('overlays', () => {
  it('closes a dialog with Escape', async () => {
    const user = userEvent.setup()
    function Probe() {
      const [open, setOpen] = useState(true)
      return (
        <Dialog open={open} onClose={() => setOpen(false)} title="Confirm">
          Body
        </Dialog>
      )
    }
    render(<Probe />)
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a dropdown and selects from the keyboard', async () => {
    const user = userEvent.setup()
    let selected = ''
    render(
      <DropdownMenu
        label="Status"
        items={[
          {
            id: 'todo',
            label: 'Todo',
            onSelect: () => {
              selected = 'todo'
            },
          },
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    await user.keyboard('{Enter}')
    expect(selected).toBe('todo')
  })
})
