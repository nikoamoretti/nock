/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { AppShell } from '../components/app-shell'
import { CommandPalette } from '../components/command-palette'
import { Composer } from '../components/composer'
import { HelpOverlay } from '../components/help-overlay'
import { IssueList } from '../components/issue-list'
import { PersistBanner } from '../components/persist-banner'
import { SearchOverlay } from '../components/search-overlay'
import { StoreProvider } from '../hooks/use-nock'
import { createBootstrapSnapshot } from '../lib/seed'
import { NockStore } from '../lib/store'

afterEach(cleanup)

function renderStore(store: NockStore, ui: ReactNode) {
  return render(
    <MemoryRouter>
      <StoreProvider store={store}>{ui}</StoreProvider>
    </MemoryRouter>,
  )
}

describe('shell accessibility regressions', () => {
  it('exposes composer, palette, and help as modal dialogs', () => {
    const composerStore = NockStore.from(createBootstrapSnapshot({ demo: false }))
    composerStore.openComposer('all')
    renderStore(composerStore, <Composer />)
    expect(screen.getByRole('dialog', { name: 'New issue' })).toBeTruthy()
    cleanup()

    const paletteStore = NockStore.from(createBootstrapSnapshot({ demo: false }))
    paletteStore.ui.commandOpen = true
    renderStore(paletteStore, <CommandPalette />)
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeTruthy()
    cleanup()

    const helpStore = NockStore.from(createBootstrapSnapshot({ demo: false }))
    renderStore(helpStore, <HelpOverlay onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy()
  })

  it('announces persist failures without a loading spinner', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.persistError = 'disk full'
    store.bump()
    renderStore(store, <PersistBanner />)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Couldn’t save locally')
    expect(status.querySelector('[aria-busy]')).toBeNull()
  })

  it('keeps a single tab stop on the highlighted issue row', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: true }))
    const issues = store.issuesForView('all')
    store.highlightIssue(issues[0]!.id)
    renderStore(store, <IssueList issues={issues} view="all" />)
    const rows = screen.getAllByRole('option')
    expect(rows.length).toBeGreaterThan(1)
    const tabbable = rows.filter((row) => row.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(screen.getByRole('listbox', { name: 'Issues' })).toBeTruthy()
    const headers = document.querySelectorAll('[data-testid^="group-header-"]')
    expect(headers.length).toBeGreaterThan(0)
    for (const header of headers) {
      expect(header.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('exposes a skip link to main content', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    renderStore(store, <AppShell />)
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip.getAttribute('href')).toBe('#nock-main')
  })

  it('exposes search as a separate dialog from the command palette', () => {
    const store = NockStore.from(createBootstrapSnapshot({ demo: false }))
    store.ui.searchOpen = true
    renderStore(store, <SearchOverlay />)
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy()
  })
})
