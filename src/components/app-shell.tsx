import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { viewFromPath } from '../lib/view-from-path'
import { searchFromFilters } from '../lib/url-filters'
import { CommandPalette } from './command-palette'
import { Composer } from './composer'
import { HelpOverlay } from './help-overlay'
import { PersistBanner } from './persist-banner'
import { PropertyMenu } from './property-menu'
import { Sidebar } from './sidebar'

export function AppShell() {
  const store = useNock()
  const navigate = useNavigate()
  const location = useLocation()
  const view = viewFromPath(location.pathname)

  useEffect(() => {
    store.commands.setHost({
      view,
      pathname: location.pathname,
      search: location.search,
      navigate: (to) => {
        if (typeof to === 'number') {
          navigate(to)
          return
        }
        navigate({ pathname: to, search: searchFromFilters(store.ui.filters) })
      },
    })
  }, [store, navigate, view, location.pathname, location.search])

  useEffect(() => store.commands.attachWindow(), [store])

  return (
    <div className="flex h-full" data-testid="workspace-ready">
      <Sidebar />
      <main id="nock-main" aria-label="Workspace" className="flex min-w-0 flex-1">
        <Outlet />
      </main>
      <PersistBanner />
      {store.ui.composerOpen && <Composer />}
      {store.ui.commandOpen && <CommandPalette />}
      {store.ui.helpOpen && (
        <HelpOverlay onClose={() => store.commands.run('surface.dismiss')} />
      )}
      <PropertyMenu />
    </div>
  )
}
