import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { viewFromPath } from '../lib/view-from-path'
import { collectionPath, issuePeekPath } from '../lib/paths'
import { Avatar, PropertyButton } from './property-menu'
import { PriorityIcon, StatusIcon } from './icons'

export function Composer() {
  const store = useNock()
  const navigate = useNavigate()
  const location = useLocation()
  const titleRef = useRef<HTMLInputElement>(null)
  const draft = store.ui.composer
  const state = store.states.get(draft.stateId)
  const assignee = draft.assigneeId ? store.users.get(draft.assigneeId) : undefined
  const project = draft.projectId ? store.projects.get(draft.projectId) : undefined
  const cycle = draft.cycleId ? store.cycles.get(draft.cycleId) : undefined

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  function finishCreate(): void {
    const created = store.submitComposer()
    if (!created) return
    const view = viewFromPath(location.pathname)
    const list =
      typeof document !== 'undefined' && typeof HTMLElement !== 'undefined'
        ? document.querySelector('[data-testid=issue-list]')
        : null
    store.rememberCollection({
      pathname: collectionPath(view),
      search: location.search,
      scrollTop:
        list instanceof HTMLElement ? list.scrollTop : store.ui.listScrollTop,
      highlightId: created.id,
      selectedIds: [created.id],
    })
    navigate(issuePeekPath(view, created.identifier))
  }

  if (!store.ui.composerOpen) return null

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/50 pt-[12vh]"
      onMouseDown={() => store.commands.run('surface.dismiss')}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title-label"
        className="nock-overlay w-[640px] overflow-hidden rounded-xl border border-line bg-lift"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          finishCreate()
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            finishCreate()
          }
        }}
      >
        <div className="border-b border-line px-4 py-3">
          <div id="composer-title-label" className="text-[12px] text-mute">
            {draft.parentId
              ? `Sub-issue of ${store.issue(draft.parentId)?.identifier ?? 'issue'}`
              : 'New issue'}
          </div>
            <input
            ref={titleRef}
            data-testid="composer-title"
            value={draft.title}
            onChange={(event) => store.setComposer({ title: event.target.value })}
            placeholder="Issue title"
            className="mt-1 w-full bg-transparent text-[18px] font-medium text-ink outline-none placeholder:text-dim"
          />
          <textarea
            value={draft.description}
            onChange={(event) =>
              store.setComposer({ description: event.target.value })
            }
            placeholder="Add description…"
            rows={5}
            className="mt-2 w-full resize-none bg-transparent text-[13px] leading-6 text-ink outline-none placeholder:text-dim"
          />
        </div>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex flex-wrap items-center gap-0.5">
            <PropertyButton
              title="Status"
              onClick={() => store.commands.run('issue.setStatus')}
            >
              {state && <StatusIcon state={state} />}
              {state?.name}
            </PropertyButton>
            <PropertyButton
              title="Assignee"
              onClick={() => store.commands.run('issue.setAssignee')}
            >
              {assignee ? <Avatar user={assignee} /> : <span className="text-dim">Assignee</span>}
              {assignee?.name}
            </PropertyButton>
            <PropertyButton
              title="Priority"
              onClick={() => store.commands.run('issue.setPriority')}
            >
              <PriorityIcon priority={draft.priority} />
            </PropertyButton>
            <PropertyButton
              title="Project"
              onClick={() => store.commands.run('issue.setProject')}
            >
              {project?.name ?? 'Project'}
            </PropertyButton>
            <PropertyButton
              title="Cycle"
              onClick={() => store.commands.run('issue.setCycle')}
            >
              {cycle ? `Cycle ${cycle.number}` : 'Cycle'}
            </PropertyButton>
            <PropertyButton
              title="Labels"
              onClick={() => store.commands.run('issue.addLabel')}
            >
              {draft.labelIds.length ? `${draft.labelIds.length} labels` : 'Labels'}
            </PropertyButton>
          </div>
          <button
            type="submit"
            data-testid="composer-create"
            disabled={!draft.title.trim()}
            className="mr-1 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
