import { NavLink } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { isDesktopApp } from '../lib/desktop'
import { NockMark } from './icons'

const TEAM_LINKS = [
  { to: '/eng/all', label: 'All issues' },
  { to: '/eng/active', label: 'Active' },
  { to: '/eng/backlog', label: 'Backlog' },
  { to: '/eng/board', label: 'Board' },
  { to: '/projects', label: 'Projects' },
  { to: '/cycles', label: 'Cycles' },
]

export function Sidebar() {
  const store = useNock()
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
        onClick={() => store.openCommand()}
        className="mx-2 mb-2 flex items-center justify-between rounded-md border border-line bg-fill px-2 py-1.5 text-[12px] text-mute hover:bg-hover"
      >
        Search
        <span className="rounded border border-line px-1 text-[10px]">⌘K</span>
      </button>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        <SideLink to="/inbox" label="Inbox" count={inboxCount} />
        <SideLink to="/my-issues" label="My issues" count={mineCount} />
        <div className="mt-4 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-dim">
          Engineering
        </div>
        {TEAM_LINKS.map((link) => (
          <SideLink key={link.to} to={link.to} label={link.label} />
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3 text-[11px] leading-5 text-dim">
        <div className="text-[12px] text-mute">{store.me().name}</div>
        <div className="mt-1">C new · ⌘K command · G then I M A B</div>
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
  return (
    <NavLink
      to={to}
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
