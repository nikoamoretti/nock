/** @vitest-environment jsdom */

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Tabs } from './tabs'

afterEach(cleanup)

describe('Tabs', () => {
  it('moves with arrow keys', async () => {
    const user = userEvent.setup()
    function Probe() {
      const [value, setValue] = useState('one')
      return (
        <Tabs
          label="Example"
          value={value}
          onValueChange={setValue}
          items={[
            { id: 'one', label: 'One', panel: 'First' },
            { id: 'two', label: 'Two', panel: 'Second' },
          ]}
        />
      )
    }
    render(<Probe />)
    screen.getByRole('tab', { name: 'One' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByRole('tabpanel').textContent).toBe('Second')
  })
})
