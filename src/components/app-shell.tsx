import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { viewFromPath } from '../lib/view-from-path'
import { searchFromFilters } from '../lib/url-filters'
import { CommandMenu } from './command-menu'
import { Composer } from './composer'
import { HelpOverlay } from './help-overlay'
import { PropertyMenu } from './property-menu'
import { Sidebar } from './sidebar'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
}

export function AppShell() {
  const store = useNock()
  const navigate = useNavigate()
  const location = useLocation()
  const view = viewFromPath(location.pathname)

  useEffect(() => {
    let go = false
    let goTimer = 0
    const goTo = (pathname: string) => {
      navigate({ pathname, search: searchFromFilters(store.ui.filters) })
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        store.openCommand()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        store.dismissOverlays()
        return
      }
      if (isTypingTarget(event.target)) return
      if (
        ((event.metaKey || event.ctrlKey) && event.key === '/') ||
        event.key === '?'
      ) {
        event.preventDefault()
        store.toggleHelp()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        if (view === 'inbox' || view === 'projects' || view === 'cycles') return
        if (view === 'board') {
          store.setLayout('list')
          goTo('/eng/all')
          return
        }
        store.toggleLayout(view)
        return
      }
      if (go) {
        go = false
        window.clearTimeout(goTimer)
        const key = event.key.toLowerCase()
        if (key === 'i' || key === 't') goTo('/inbox')
        if (key === 'm') goTo('/my-issues')
        if (key === 'a') goTo('/eng/all')
        if (key === 'b') goTo('/eng/board')
        if (key === 'p') goTo('/projects')
        if (key === 'c') goTo('/cycles')
        event.preventDefault()
        return
      }
      if (event.key === 'g') {
        go = true
        goTimer = window.setTimeout(() => {
          go = false
        }, 800)
        return
      }
      if (event.key === 'c' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        store.openComposer(view)
        return
      }
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        store.highlightRelative(view, 1)
        return
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        store.highlightRelative(view, -1)
        return
      }
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        store.togglePeek()
        return
      }
      if (event.key.toLowerCase() === 'x') {
        event.preventDefault()
        store.toggleSelect()
        return
      }
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        store.toggleFilterMenu()
        return
      }
      if (event.shiftKey && event.key.toLowerCase() === 'v' && !event.metaKey) {
        event.preventDefault()
        store.toggleDisplayMenu()
        return
      }
      if (view === 'inbox' && event.key === '1') {
        event.preventDefault()
        store.acceptTriage('inbox')
        return
      }
      if (view === 'inbox' && event.key === '3') {
        event.preventDefault()
        store.declineTriage('inbox')
        return
      }
      if (event.key === 'p') {
        event.preventDefault()
        store.openPropertyMenu('priority')
        return
      }
      if (event.key === 't') {
        event.preventDefault()
        store.openPropertyMenu('status')
        return
      }
      if (event.key === 'a') {
        event.preventDefault()
        store.openPropertyMenu('assignee')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(goTimer)
      window.removeEventListener('keydown', onKey)
    }
  }, [store, navigate, view])

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1">
        <Outlet />
      </main>
      {store.ui.composerOpen && <Composer />}
      {store.ui.commandOpen && <CommandMenu />}
      {store.ui.helpOpen && <HelpOverlay onClose={() => store.toggleHelp()} />}
      <PropertyMenu />
    </div>
  )
}
