import { NavLink } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { formatShortcut } from '../lib/command-system'
import { isDesktopApp } from '../lib/desktop'
import {
  collectionPath,
  type PathScope,
} from '../lib/paths'
import { searchFromAst } from '../lib/url-filters'
import { NockMark } from './icons'

function teamLinks(scope: PathScope) {
  return [
    { to: collectionPath('projects', scope), label: 'Projects' },
    { to: collectionPath('initiatives', scope), label: 'Initiatives' },
    { to: collectionPath('all', scope), label: 'All issues' },
    { to: collectionPath('active', scope), label: 'Active' },
    { to: collectionPath('backlog', scope), label: 'Backlog' },
    { to: collectionPath('board', scope), label: 'Board' },
    { to: collectionPath('cycles', scope), label: 'Cycles' },
  ]
}

export function Sidebar() {
  const store = useNock()
  const scope = store.routeScope()
  const inboxCount = store.issuesForView('inbox').length
  const mineCount = store.issuesForView('my-issues').length

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-side">
      <div
        data-tauri-drag-region
        className={cn(
          'flex items-center gap-2 px-3 py-3',
          isDesktopApp() && 'pt-10',
        )}
      >
        <NockMark className="h-5 w-5" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{store.workspace.name}</div>
          <div className="text-[11px] text-mute">Nock</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => store.commands.run('workspace.search')}
        className="mx-2 mb-2 flex items-center justify-between rounded-md border border-line bg-fill px-2 py-1.5 text-[12px] text-mute hover:bg-hover"
      >
        Search
        <span className="rounded border border-line px-1 text-[10px]">
          {formatShortcut({ key: '/' })}
        </span>
      </button>
      <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Workspace">
        <SideLink to={collectionPath('inbox', scope)} label="Inbox" count={inboxCount} />
        <SideLink to={collectionPath('my-issues', scope)} label="My issues" count={mineCount} />
        <div className="mt-4 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-dim">
          Workspace
        </div>
        {teamLinks(scope).map((link) => (
          <SideLink key={link.to} to={link.to} label={link.label} />
        ))}
        {store.savedViews.size > 0 && (
          <>
            <div className="mt-4 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-dim">
              Saved views
            </div>
            {[...store.savedViews.values()].map((saved) => (
              <button
                key={saved.id}
                type="button"
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-mute hover:bg-hover hover:text-ink',
                  store.ui.savedViewId === saved.id && 'bg-hover text-ink',
                )}
                onClick={() => store.applySavedView(saved.id)}
              >
                {saved.name}
              </button>
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-line px-3 py-3 text-[11px] leading-5 text-dim">
        <div className="text-[12px] text-mute">{store.me().name}</div>
        <div className="mt-1">C new · / search · ⌘K command · ? help</div>
      </div>
    </aside>
  )
}

function SideLink({
  to,
  label,
  count,
}: {
  to: string
  label: string
  count?: number
}) {
  const store = useNock()
  return (
    <NavLink
      to={`${to}${searchFromAst(store.ui.filterAst, store.ui.filterCombine)}`}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-mute hover:bg-hover hover:text-ink',
          isActive && 'bg-hover text-ink',
        )
      }
    >
      <span>{label}</span>
      {count ? <span className="text-[11px] text-dim">{count}</span> : null}
    </NavLink>
  )
}
