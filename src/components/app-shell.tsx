import { useEffect, useLayoutEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { parseAppPath } from '../lib/paths'
import { viewFromPath } from '../lib/view-from-path'
import { searchFromAst } from '../lib/url-filters'
import { CommandPalette } from './command-palette'
import { Composer } from './composer'
import { ScopeUnavailable } from './document-page'
import { HelpOverlay } from './help-overlay'
import { PersistBanner } from './persist-banner'
import { PropertyMenu } from './property-menu'
import { SearchOverlay } from './search-overlay'
import { Sidebar } from './sidebar'

export function AppShell() {
  const store = useNock()
  const navigate = useNavigate()
  const location = useLocation()
  const view = viewFromPath(location.pathname)
  const parsed = parseAppPath(location.pathname)
  const workspaceMismatch = Boolean(
    parsed && parsed.workspaceKey !== store.workspace.urlKey,
  )
  const unknownTeam = Boolean(
    parsed?.teamKey && !store.teamByKey(parsed.teamKey),
  )

  useLayoutEffect(() => {
    if (workspaceMismatch || unknownTeam) return
    const nextKey =
      parsed?.teamKey && store.teamByKey(parsed.teamKey)
        ? parsed.teamKey
        : null
    store.setRouteTeamKey(nextKey)
  }, [parsed?.teamKey, store, unknownTeam, workspaceMismatch])

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
        navigate({
          pathname: to,
          search: searchFromAst(store.ui.filterAst, store.ui.filterCombine),
        })
      },
    })
  }, [store, navigate, view, location.pathname, location.search])

  useEffect(() => store.commands.attachWindow(), [store])

  return (
    <div className="flex h-full" data-testid="workspace-ready">
      <a
        href="#nock-main"
        className="sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:h-auto focus:w-auto focus:rounded-md focus:bg-lift focus:px-3 focus:py-2 focus:text-[13px] focus:text-ink"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="nock-main" aria-label="Workspace" className="flex min-w-0 flex-1">
        {workspaceMismatch ? (
          <ScopeUnavailable reason="workspace" />
        ) : unknownTeam ? (
          <ScopeUnavailable reason="team" />
        ) : (
          <Outlet />
        )}
      </main>
      <PersistBanner />
      {store.ui.composerOpen && <Composer />}
      {store.ui.commandOpen && <CommandPalette />}
      {store.ui.searchOpen && <SearchOverlay />}
      {store.ui.helpOpen && (
        <HelpOverlay onClose={() => store.commands.run('surface.dismiss')} />
      )}
      <PropertyMenu />
    </div>
  )
}
