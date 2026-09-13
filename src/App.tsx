import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { IssueDetailPage } from './components/issue-detail'
import { IssueView } from './components/issue-view'
import {
  CyclesView,
  CycleDetail,
  InitiativeDetail,
  InitiativesView,
  ProjectDetail,
  ProjectsView,
} from './components/plan-views'
import { StoreProvider, useNock } from './hooks/use-nock'
import { isDesktopApp } from './lib/desktop'
import { IdbPersistence } from './lib/persist'
import {
  collectionPath,
  locationNeedsCanonical,
} from './lib/paths'
import { NockStore } from './lib/store'
import { UiGallery } from './ui/gallery'
import { ThemeProvider } from './ui/theme'

let boot: Promise<NockStore> | null = null

function openWorkspace(): Promise<NockStore> {
  boot ??= NockStore.open(new IdbPersistence())
  return boot
}

function AppHistory({ children }: { children: React.ReactNode }) {
  if (isDesktopApp() && import.meta.env.PROD) {
    return <HashRouter>{children}</HashRouter>
  }
  return <BrowserRouter>{children}</BrowserRouter>
}

function WorkspaceLayout() {
  const [store, setStore] = useState<NockStore | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    openWorkspace()
      .then((next) => {
        if (!cancelled) setStore(next)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[nock] failed to open workspace', err)
        if (!cancelled) setError(message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-secondary">
        Failed to load Nock: {error}
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-secondary">
        Loading workspace…
      </div>
    )
  }

  return (
    <StoreProvider store={store}>
      <NockTestHook store={store} />
      <LocationCanonicalizer />
      <AppShell />
    </StoreProvider>
  )
}

function LocationCanonicalizer() {
  const store = useNock()
  const location = useLocation()
  const next = locationNeedsCanonical(
    location.pathname,
    location.hash,
    store.routeScope(),
  )
  if (!next) return null
  return (
    <Navigate
      to={{ pathname: next, search: location.search, hash: '' }}
      replace
    />
  )
}

function HomeRedirect() {
  const store = useNock()
  const location = useLocation()
  if (location.hash.startsWith('#/')) return null
  return (
    <Navigate to={collectionPath('projects', store.routeScope())} replace />
  )
}

function LegacyCatchAll() {
  const store = useNock()
  const location = useLocation()
  const next =
    locationNeedsCanonical(
      location.pathname,
      location.hash,
      store.routeScope(),
    ) ?? collectionPath('projects', store.routeScope())
  return <Navigate to={`${next}${location.search}`} replace />
}

function NockTestHook({ store }: { store: NockStore }) {
  useEffect(() => {
    const host = window as unknown as { __NOCK__?: NockStore }
    host.__NOCK__ = store
    return () => {
      if (host.__NOCK__ === store) delete host.__NOCK__
    }
  }, [store])
  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <AppHistory>
        <Routes>
          <Route path="/_ui" element={<UiGallery />} />
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/:workspaceKey/inbox" element={<IssueView view="inbox" />} />
            <Route
              path="/:workspaceKey/inbox/:identifier"
              element={<IssueView view="inbox" />}
            />
            <Route
              path="/:workspaceKey/my-issues"
              element={<IssueView view="my-issues" />}
            />
            <Route
              path="/:workspaceKey/my-issues/:identifier"
              element={<IssueView view="my-issues" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/all"
              element={<IssueView view="all" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/all/:identifier"
              element={<IssueView view="all" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/active"
              element={<IssueView view="active" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/active/:identifier"
              element={<IssueView view="active" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/backlog"
              element={<IssueView view="backlog" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/backlog/:identifier"
              element={<IssueView view="backlog" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/board"
              element={<IssueView view="board" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/board/:identifier"
              element={<IssueView view="board" />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/cycles"
              element={<CyclesView />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/cycles/:cycleId"
              element={<CycleDetail />}
            />
            <Route
              path="/:workspaceKey/team/:teamKey/cycle/:cycleId"
              element={<CycleDetail />}
            />
            <Route path="/:workspaceKey/issue/:identifier" element={<IssueDetailPage />} />
            <Route path="/:workspaceKey/projects" element={<ProjectsView />} />
            <Route
              path="/:workspaceKey/project/:projectId"
              element={<ProjectDetail />}
            />
            <Route path="/:workspaceKey/projects/:projectId" element={<ProjectDetail />} />
            <Route path="/:workspaceKey/initiatives" element={<InitiativesView />} />
            <Route
              path="/:workspaceKey/initiative/:initiativeId"
              element={<InitiativeDetail />}
            />
            <Route
              path="/:workspaceKey/initiatives/:initiativeId"
              element={<InitiativeDetail />}
            />
            <Route path="*" element={<LegacyCatchAll />} />
          </Route>
        </Routes>
      </AppHistory>
    </ThemeProvider>
  )
}
