import type { ReactNode } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import type { Priority, User } from '../lib/types'
import { PriorityIcon, StatusIcon } from './icons'

const AVATAR = ['#6b75f0', '#26b5ce', '#4cb782', '#f2994a', '#eb5757']

export function Avatar({ user, size = 18 }: { user: User; size?: number }) {
  const color = AVATAR[Math.abs(hash(user.id)) % AVATAR.length]
  return (
    <span
      title={user.name}
      className="inline-flex items-center justify-center rounded-full text-[10px] font-medium text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(8, size * 0.42),
      }}
    >
      {user.initials}
    </span>
  )
}

function hash(value: string): number {
  let n = 0
  for (const ch of value) n = (n * 31 + ch.charCodeAt(0)) | 0
  return n
}

export function PropertyButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-mute hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  )
}

export function PropertyMenu() {
  const store = useNock()
  const kind = store.ui.propertyMenu
  if (!kind) return null

  const issue = store.selectedIssue()
  const subject = store.ui.composerOpen ? store.ui.composer : issue
  if (!subject) return null

  const options = optionsFor(store, kind)

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.dismissOverlays()}>
      <div
        className="nock-overlay absolute left-1/2 top-[18%] w-[320px] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-lift"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] text-mute">
          {kind === 'status' && 'Set status'}
          {kind === 'priority' && 'Set priority'}
          {kind === 'assignee' && 'Assign'}
          {kind === 'project' && 'Project'}
          {kind === 'cycle' && 'Cycle'}
        </div>
        <div className="max-h-[320px] overflow-auto p-1">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover',
                option.active && 'bg-hover text-ink',
              )}
              onClick={() =>
                store.execute({
                  type: 'issue.setProperty',
                  kind,
                  value: option.value,
                })
              }
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function optionsFor(
  store: ReturnType<typeof useNock>,
  kind: NonNullable<typeof store.ui.propertyMenu>,
): Array<{
  value: string | number | null
  label: string
  icon: ReactNode
  active: boolean
}> {
  const issue = store.selectedIssue()
  const current = store.ui.composerOpen ? store.ui.composer : issue
  if (!current) return []
  if (kind === 'status') {
    return store.statesForTeam(store.defaultTeam().id).map((state) => ({
      value: state.id,
      label: state.name,
      icon: <StatusIcon state={state} />,
      active: current.stateId === state.id,
    }))
  }
  if (kind === 'priority') {
    const values: Priority[] = [0, 1, 2, 3, 4]
    const labels = ['No priority', 'Urgent', 'High', 'Medium', 'Low']
    return values.map((value) => ({
      value,
      label: labels[value],
      icon: <PriorityIcon priority={value} />,
      active: current.priority === value,
    }))
  }
  if (kind === 'assignee') {
    return [
      {
        value: null,
        label: 'Unassigned',
        icon: <span className="h-4 w-4 rounded-full border border-dashed border-dim" />,
        active: current.assigneeId === null,
      },
      ...[...store.users.values()].map((user) => ({
        value: user.id,
        label: user.name,
        icon: <Avatar user={user} />,
        active: current.assigneeId === user.id,
      })),
    ]
  }
  if (kind === 'project') {
    return [
      {
        value: null,
        label: 'No project',
        icon: <span className="w-3.5" />,
        active: current.projectId === null,
      },
      ...[...store.projects.values()].map((project) => ({
        value: project.id,
        label: project.name,
        icon: <span className="h-2 w-2 rounded-sm bg-accent" />,
        active: current.projectId === project.id,
      })),
    ]
  }
  return [
    {
      value: null,
      label: 'No cycle',
      icon: <span className="w-3.5" />,
      active: current.cycleId === null,
    },
    ...[...store.cycles.values()].map((cycle) => ({
      value: cycle.id,
      label: `Cycle ${cycle.number}`,
      icon: <span className="text-[11px] text-mute">C{cycle.number}</span>,
      active: current.cycleId === cycle.id,
    })),
  ]
}
