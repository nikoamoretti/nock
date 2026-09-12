import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import { filtersActive } from '../lib/filters'
import type { Issue, ViewId } from '../lib/types'
import { filtersFromSearch, searchFromFilters } from '../lib/url-filters'
import { BulkBar } from './bulk-bar'
import { DisplayMenu } from './display-menu'
import { FilterMenu } from './filter-menu'
import { IssueBoard } from './issue-board'
import { IssuePeek } from './issue-detail'
import { IssueList } from './issue-list'
import { NotificationInbox } from './notification-inbox'

const TITLES: Record<ViewId, string> = {
  inbox: 'Inbox',
  'my-issues': 'My issues',
  all: 'All issues',
  active: 'Active',
  backlog: 'Backlog',
  board: 'Board',
  projects: 'Projects',
  cycles: 'Cycles',
  initiatives: 'Initiatives',
}

export function IssueView({ view }: { view: ViewId }) {
  const store = useNock()
  const location = useLocation()
  const navigate = useNavigate()
  const { identifier } = useParams()
  const storeSearch = searchFromFilters(store.ui.filters)

  useEffect(() => {
    store.setFilters(filtersFromSearch(location.search))
  }, [location.search, store])

  useEffect(() => {
    const current = searchFromFilters(filtersFromSearch(location.search))
    if (current !== storeSearch) {
      navigate(
        { pathname: location.pathname, search: storeSearch },
        { replace: true },
      )
    }
  }, [location.pathname, location.search, navigate, storeSearch])

  useEffect(() => {
    if (identifier) {
      const issue = store.issueByIdentifier(identifier)
      if (issue) store.openIssuePeek(issue.id)
      return
    }
    if (store.ui.peekOpen) {
      store.ui.peekOpen = false
      store.dropModal('peek')
    }
    const restore = store.ui.collectionRestore
    if (!restore) {
      store.bump()
      return
    }
    store.ui.highlightedIssueId = restore.highlightId
    store.ui.selectedIssueIds = [...restore.selectedIds]
    store.ui.pendingListScroll = restore.scrollTop
    store.bump()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = restore.highlightId
          ? document.querySelector<HTMLElement>(
              `[data-testid^="issue-row-"][data-highlighted]`,
            )
          : null
        row?.focus()
      })
    })
  }, [identifier, store])

  const issueIds = store.issueIdsForView(view)
  const issues = issueIds
    .map((id) => store.issue(id))
    .filter((issue): issue is Issue => Boolean(issue))
  const layout = store.effectiveLayout(view)
  const peeked = store.peekedIssue()
  const filterOn = filtersActive(store.ui.filters)

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4"
        >
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-medium">{TITLES[view]}</div>
            {view === 'inbox' && (
              <div className="ml-2 flex rounded-md border border-line text-[12px] font-normal" role="tablist" aria-label="Inbox">
                {(['triage', 'priority', 'other'] as const).map((pane) => (
                  <button
                    key={pane}
                    type="button"
                    role="tab"
                    aria-selected={store.ui.inboxPane === pane}
                    data-testid={`inbox-pane-${pane}`}
                    className={cn(
                      'px-2 py-1 capitalize',
                      store.ui.inboxPane === pane ? 'bg-hover text-ink' : 'text-mute',
                    )}
                    onClick={() => store.setInboxPane(pane)}
                  >
                    {pane === 'triage' ? 'Queue' : pane === 'priority' ? 'Priority' : 'Other'}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[12px] text-dim" data-testid="issue-count">
              {view === 'inbox' && store.ui.inboxPane !== 'triage'
                ? store.inboxNotifications(store.ui.inboxPane).length
                : issues.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {view === 'inbox' && store.ui.inboxPane === 'triage' && (
              <>
                <HeaderButton
                  label="Accept"
                  hint="1"
                  onClick={() => store.commands.run('issue.acceptTriage')}
                />
                <HeaderButton
                  label="Duplicate"
                  hint="2"
                  onClick={() => store.commands.run('issue.duplicateTriage')}
                />
                <HeaderButton
                  label="Decline"
                  hint="3"
                  onClick={() => store.commands.run('issue.declineTriage')}
                />
                <HeaderButton
                  label="Snooze"
                  hint="H"
                  onClick={() => store.commands.run('issue.snoozeTriage')}
                />
              </>
            )}
            <HeaderButton
              label="Filter"
              hint="F"
              testId="filter-button"
              active={filterOn || store.ui.filterMenuOpen}
              onClick={() => store.commands.run('view.openFilters')}
            />
            <HeaderButton
              label="Display"
              hint="⇧V"
              testId="display-button"
              active={store.ui.displayMenuOpen}
              onClick={() => store.commands.run('view.openDisplayOptions')}
            />
            {view !== 'inbox' && (
              <>
                <ViewSwitch
                  active={layout === 'list'}
                  label="List"
                  onClick={() => {
                    if (layout === 'board') store.commands.run('view.toggleLayout')
                    else store.setLayout('list')
                  }}
                />
                <ViewSwitch
                  active={layout === 'board'}
                  label="Board"
                  onClick={() => store.setLayout('board')}
                />
              </>
            )}
            <button
              type="button"
              data-testid="new-issue"
              className="ml-2 rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-white"
              onClick={() => store.commands.run('issue.create')}
            >
              New issue
            </button>
          </div>
        </header>
        {view === 'inbox' && store.ui.inboxPane !== 'triage' ? (
          <NotificationInbox pane={store.ui.inboxPane} />
        ) : issues.length === 0 ? (
          <Empty view={view} />
        ) : layout === 'board' ? (
          <IssueBoard issues={issues} />
        ) : (
          <IssueList issues={issues} view={view} />
        )}
        <BulkBar />
      </div>
      {peeked && <IssuePeek />}
      <FilterMenu />
      <DisplayMenu />
    </div>
  )
}

function HeaderButton({
  label,
  hint,
  active,
  onClick,
  testId,
}: {
  label: string
  hint: string
  active?: boolean
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
    >
      {label}
      <span className="ml-1 text-[10px] text-dim">{hint}</span>
    </button>
  )
}

function ViewSwitch({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover hover:text-ink',
        active && 'bg-hover text-ink',
      )}
    >
      {label}
    </button>
  )
}

function Empty({ view }: { view: ViewId }) {
  const copy =
    view === 'inbox'
      ? 'Triage is clear'
      : view === 'my-issues'
        ? 'Nothing assigned to you'
        : 'No issues in this view'
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-mute">
      {copy}
    </div>
  )
}
