import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { IssueView } from './components/issue-view'
import { CyclesView, ProjectsView } from './components/plan-views'
import { StoreProvider } from './hooks/use-nock'
import { IdbPersistence } from './lib/persist'
import { NockStore } from './lib/store'

let boot: Promise<NockStore> | null = null

function openWorkspace(): Promise<NockStore> {
  boot ??= NockStore.open(new IdbPersistence())
  return boot
}

export default function App() {
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
      <div className="flex h-full items-center justify-center text-[13px] text-mute">
        Failed to load Nock: {error}
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-mute">
        Loading workspace…
      </div>
    )
  }

  return (
    <StoreProvider store={store}>
      <div className="h-full">
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/inbox" replace />} />
              <Route path="/inbox" element={<IssueView view="inbox" />} />
              <Route path="/my-issues" element={<IssueView view="my-issues" />} />
              <Route path="/eng/all" element={<IssueView view="all" />} />
              <Route path="/eng/active" element={<IssueView view="active" />} />
              <Route path="/eng/backlog" element={<IssueView view="backlog" />} />
              <Route path="/eng/board" element={<IssueView view="board" />} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="/cycles" element={<CyclesView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </StoreProvider>
  )
}
