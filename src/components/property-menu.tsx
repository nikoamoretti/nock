import type { ReactNode } from 'react'
import { useNock } from '../hooks/use-nock'
import { cn } from '../lib/cn'
import type { Priority, User } from '../lib/types'
import { Avatar as UiAvatar } from '../ui/display'
import { PriorityIcon, StatusIcon } from './icons'

export function Avatar({ user, size = 18 }: { user: User; size?: number }) {
  return <UiAvatar name={user.name} initials={user.initials} size={size} />
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
    <div className="fixed inset-0 z-40" onMouseDown={() => store.commands.run('surface.dismiss')}>
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
          {kind === 'label' && 'Labels'}
          {kind === 'milestone' && 'Milestone'}
          {kind === 'team' && 'Team'}
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
              onClick={() => runProperty(store, kind, option.value)}
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
  if (kind === 'cycle') {
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
  if (kind === 'label') {
    const selected = new Set(
      store.ui.composerOpen
        ? store.ui.composer.labelIds
        : (store.actionIssue()?.labelIds ?? []),
    )
    return [...store.labels.values()].map((label) => ({
      value: label.id,
      label: label.name,
      icon: (
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ background: label.color }}
        />
      ),
      active: selected.has(label.id),
    }))
  }
  if (kind === 'milestone') {
    return [
      {
        value: null,
        label: 'No milestone',
        icon: <span className="w-3.5" />,
        active: ('milestoneId' in current ? current.milestoneId : null) === null,
      },
      ...[...store.milestones.values()].map((milestone) => ({
        value: milestone.id,
        label: milestone.name,
        icon: <span className="h-2 w-2 rounded-sm bg-accent" />,
        active: 'milestoneId' in current && current.milestoneId === milestone.id,
      })),
    ]
  }
  return [...store.teams.values()].map((team) => ({
    value: team.id,
    label: team.name,
    icon: <span className="text-[11px] text-mute">{team.key}</span>,
    active: store.ui.composerOpen
      ? store.ui.composer.teamId === team.id
      : store.actionIssue()?.teamId === team.id,
  }))
}

function runProperty(
  store: ReturnType<typeof useNock>,
  kind: NonNullable<typeof store.ui.propertyMenu>,
  value: string | number | null,
): void {
  if (kind === 'status') store.commands.run('issue.setStatus', { stateId: String(value) })
  else if (kind === 'priority') store.commands.run('issue.setPriority', { priority: value })
  else if (kind === 'assignee') store.commands.run('issue.setAssignee', { assigneeId: value })
  else if (kind === 'project') store.commands.run('issue.setProject', { projectId: value })
  else if (kind === 'cycle') store.commands.run('issue.setCycle', { cycleId: value })
  else if (kind === 'milestone') {
    store.commands.run('issue.setMilestone', { milestoneId: value })
  } else if (kind === 'team') {
    store.commands.run('issue.moveTeam', { teamId: String(value) })
  } else if (kind === 'label') {
    const labelId = String(value)
    const ids = store.ui.composerOpen
      ? store.ui.composer.labelIds
      : (store.actionIssue()?.labelIds ?? [])
    store.commands.run(
      ids.includes(labelId) ? 'issue.removeLabel' : 'issue.addLabel',
      { labelId },
    )
  }
}
