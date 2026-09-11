import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { viewFromPath } from '../lib/view-from-path'
import { CommandMenu } from './command-menu'
import { Composer } from './composer'
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
      if (go) {
        go = false
        window.clearTimeout(goTimer)
        const key = event.key.toLowerCase()
        if (key === 'i') navigate('/inbox')
        if (key === 'm') navigate('/my-issues')
        if (key === 'a') navigate('/eng/all')
        if (key === 'b') navigate('/eng/board')
        if (key === 'p') navigate('/projects')
        if (key === 'c') navigate('/cycles')
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
        store.selectRelative(view, 1)
        return
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        store.selectRelative(view, -1)
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
      <PropertyMenu />
    </div>
  )
}
