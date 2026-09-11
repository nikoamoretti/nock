import { useEffect, useRef } from 'react'
import { useNock } from '../hooks/use-nock'
import { Avatar, PropertyButton } from './property-menu'
import { PriorityIcon, StatusIcon } from './icons'

export function Composer() {
  const store = useNock()
  const titleRef = useRef<HTMLInputElement>(null)
  const draft = store.ui.composer
  const state = store.states.get(draft.stateId)
  const assignee = draft.assigneeId ? store.users.get(draft.assigneeId) : undefined
  const project = draft.projectId ? store.projects.get(draft.projectId) : undefined
  const cycle = draft.cycleId ? store.cycles.get(draft.cycleId) : undefined

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  if (!store.ui.composerOpen) return null

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/50 pt-[12vh]"
      onMouseDown={() => store.dismissOverlays()}
    >
      <form
        className="w-[640px] overflow-hidden rounded-xl border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          store.submitComposer()
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            store.submitComposer()
          }
        }}
      >
        <div className="border-b border-line px-4 py-3">
          <div className="text-[12px] text-mute">New issue</div>
          <input
            ref={titleRef}
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
              onClick={() => store.openPropertyMenu('status')}
            >
              {state && <StatusIcon state={state} />}
              {state?.name}
            </PropertyButton>
            <PropertyButton
              title="Assignee"
              onClick={() => store.openPropertyMenu('assignee')}
            >
              {assignee ? <Avatar user={assignee} /> : <span className="text-dim">Assignee</span>}
              {assignee?.name}
            </PropertyButton>
            <PropertyButton
              title="Priority"
              onClick={() => store.openPropertyMenu('priority')}
            >
              <PriorityIcon priority={draft.priority} />
            </PropertyButton>
            <PropertyButton
              title="Project"
              onClick={() => store.openPropertyMenu('project')}
            >
              {project?.name ?? 'Project'}
            </PropertyButton>
            <PropertyButton
              title="Cycle"
              onClick={() => store.openPropertyMenu('cycle')}
            >
              {cycle ? `Cycle ${cycle.number}` : 'Cycle'}
            </PropertyButton>
          </div>
          <button
            type="submit"
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
