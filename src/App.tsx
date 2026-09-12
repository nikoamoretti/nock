import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { IssueDetailPage } from './components/issue-detail'
import { IssueView } from './components/issue-view'
import { CyclesView, CycleDetail, InitiativeDetail, InitiativesView, ProjectDetail, ProjectsView } from './components/plan-views'
import { StoreProvider } from './hooks/use-nock'
import { IdbPersistence } from './lib/persist'
import { NockStore } from './lib/store'
import { UiGallery } from './ui/gallery'
import { ThemeProvider } from './ui/theme'

let boot: Promise<NockStore> | null = null

function openWorkspace(): Promise<NockStore> {
  boot ??= NockStore.open(new IdbPersistence())
  return boot
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
      <AppShell />
    </StoreProvider>
  )
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
      <HashRouter>
        <Routes>
          <Route path="/_ui" element={<UiGallery />} />
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/inbox" element={<IssueView view="inbox" />} />
            <Route path="/inbox/:identifier" element={<IssueView view="inbox" />} />
            <Route path="/my-issues" element={<IssueView view="my-issues" />} />
            <Route path="/my-issues/:identifier" element={<IssueView view="my-issues" />} />
            <Route path="/eng/all" element={<IssueView view="all" />} />
            <Route path="/eng/all/:identifier" element={<IssueView view="all" />} />
            <Route path="/eng/active" element={<IssueView view="active" />} />
            <Route path="/eng/active/:identifier" element={<IssueView view="active" />} />
            <Route path="/eng/backlog" element={<IssueView view="backlog" />} />
            <Route path="/eng/backlog/:identifier" element={<IssueView view="backlog" />} />
            <Route path="/eng/board" element={<IssueView view="board" />} />
            <Route path="/eng/board/:identifier" element={<IssueView view="board" />} />
            <Route path="/issues/:identifier" element={<IssueDetailPage />} />
            <Route path="/projects" element={<ProjectsView />} />
            <Route path="/projects/:projectId" element={<ProjectDetail />} />
            <Route path="/cycles" element={<CyclesView />} />
            <Route path="/cycles/:cycleId" element={<CycleDetail />} />
            <Route path="/initiatives" element={<InitiativesView />} />
            <Route path="/initiatives/:initiativeId" element={<InitiativeDetail />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
