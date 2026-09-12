import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { fuzzyMatch } from '../lib/filters'
import { useNock } from '../hooks/use-nock'
import type { NockStore } from '../lib/store'
import type { Priority, PropertyMenuKind, User } from '../lib/types'
import { Avatar as UiAvatar } from '../ui/display'
import { PriorityIcon, StatusIcon } from './icons'

export type PickerItem = {
  id: string
  label: string
  value: string | number | null
  icon?: ReactNode
  active?: boolean
  keywords?: string
}

export function SearchablePicker({
  title,
  items,
  onSelect,
  onClose,
}: {
  title: string
  items: PickerItem[]
  onSelect: (item: PickerItem) => void
  onClose: () => void
}) {
  const store = useNock()
  const query = store.ui.pickerQuery
  const inputRef = useRef<HTMLInputElement>(null)
  const [index, setIndex] = useState(0)
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        fuzzyMatch(query, `${item.label} ${item.keywords ?? ''} ${item.id}`),
      ),
    [items, query],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setIndex(0)
  }, [query, items])

  const active = filtered[index]

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((current) => Math.min(filtered.length - 1, current + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((current) => Math.max(0, current - 1))
    } else if (event.key === 'Enter' && active) {
      event.preventDefault()
      onSelect(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="nock-overlay w-[320px] overflow-hidden rounded-lg border border-line bg-lift"
      role="listbox"
      aria-label={title}
      data-testid="searchable-picker"
    >
      <div className="border-b border-line px-3 py-2 text-[12px] text-mute">{title}</div>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => store.setPickerQuery(event.target.value)}
        onKeyDown={onKey}
        placeholder="Search…"
        data-testid="picker-search"
        className="w-full border-b border-line bg-transparent px-3 py-2 text-[13px] outline-none"
      />
      <div className="max-h-[320px] overflow-auto p-1">
        {filtered.length === 0 && (
          <div className="px-2 py-2 text-[13px] text-dim">No matches</div>
        )}
        {filtered.map((item, row) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={row === index}
            data-testid={`picker-option-${item.id}`}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover',
              row === index && 'bg-hover',
              item.active && 'text-ink',
            )}
            onMouseEnter={() => setIndex(row)}
            onClick={() => onSelect(item)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

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

export function StatusPicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Set status"
      items={pickerItems(store, 'status')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'status', item.value)}
    />
  )
}

export function PriorityPicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Set priority"
      items={pickerItems(store, 'priority')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'priority', item.value)}
    />
  )
}

export function AssigneePicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Assign"
      items={pickerItems(store, 'assignee')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'assignee', item.value)}
    />
  )
}

export function LabelPicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Labels"
      items={pickerItems(store, 'label')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'label', item.value)}
    />
  )
}

export function ProjectPicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Project"
      items={pickerItems(store, 'project')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'project', item.value)}
    />
  )
}

export function CyclePicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Cycle"
      items={pickerItems(store, 'cycle')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'cycle', item.value)}
    />
  )
}

export function MilestonePicker({ store, onClose }: { store: NockStore; onClose: () => void }) {
  return (
    <SearchablePicker
      title="Milestone"
      items={pickerItems(store, 'milestone')}
      onClose={onClose}
      onSelect={(item) => runProperty(store, 'milestone', item.value)}
    />
  )
}

export function PropertyMenu() {
  const store = useNock()
  const kind = store.ui.propertyMenu
  if (!kind) return null
  const issue = store.selectedIssue()
  const subject = store.ui.composerOpen ? store.ui.composer : issue
  if (!subject) return null
  const close = () => store.commands.run('surface.dismiss')
  const picker =
    kind === 'status' ? (
      <StatusPicker store={store} onClose={close} />
    ) : kind === 'priority' ? (
      <PriorityPicker store={store} onClose={close} />
    ) : kind === 'assignee' ? (
      <AssigneePicker store={store} onClose={close} />
    ) : kind === 'label' ? (
      <LabelPicker store={store} onClose={close} />
    ) : kind === 'project' ? (
      <ProjectPicker store={store} onClose={close} />
    ) : kind === 'cycle' ? (
      <CyclePicker store={store} onClose={close} />
    ) : kind === 'milestone' ? (
      <MilestonePicker store={store} onClose={close} />
    ) : kind === 'duplicate' ? (
      <SearchablePicker
        title="Mark duplicate of"
        items={pickerItems(store, 'duplicate')}
        onClose={close}
        onSelect={(item) => runProperty(store, 'duplicate', item.value)}
      />
    ) : (
      <SearchablePicker
        title="Team"
        items={pickerItems(store, 'team')}
        onClose={close}
        onSelect={(item) => runProperty(store, 'team', item.value)}
      />
    )

  return (
    <div className="fixed inset-0 z-40" onMouseDown={onCloseSafe(store)}>
      <div
        className="absolute left-1/2 top-[18%] -translate-x-1/2"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {picker}
      </div>
    </div>
  )
}

function onCloseSafe(store: NockStore) {
  return () => store.commands.run('surface.dismiss')
}

function pickerItems(store: NockStore, kind: PropertyMenuKind): PickerItem[] {
  const issue = store.selectedIssue()
  const current = store.ui.composerOpen ? store.ui.composer : issue
  if (!current) return []
  if (kind === 'status') {
    return store.statesForTeam(store.defaultTeam().id).map((state) => ({
      id: state.id,
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
      id: `p${value}`,
      value,
      label: labels[value],
      icon: <PriorityIcon priority={value} />,
      active: current.priority === value,
    }))
  }
  if (kind === 'assignee') {
    return [
      {
        id: 'unassigned',
        value: null,
        label: 'Unassigned',
        icon: <span className="h-4 w-4 rounded-full border border-dashed border-dim" />,
        active: current.assigneeId === null,
      },
      ...[...store.users.values()].map((user) => ({
        id: user.id,
        value: user.id,
        label: user.name,
        icon: <Avatar user={user} />,
        active: current.assigneeId === user.id,
        keywords: user.email,
      })),
    ]
  }
  if (kind === 'project') {
    return [
      {
        id: 'none',
        value: null,
        label: 'No project',
        active: current.projectId === null,
      },
      ...[...store.projects.values()].map((project) => ({
        id: project.id,
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
        id: 'none',
        value: null,
        label: 'No cycle',
        active: current.cycleId === null,
      },
      ...[...store.cycles.values()].map((cycle) => ({
        id: cycle.id,
        value: cycle.id,
        label: `Cycle ${cycle.number}`,
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
      id: label.id,
      value: label.id,
      label: label.name,
      icon: (
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: label.color }} />
      ),
      active: selected.has(label.id),
    }))
  }
  if (kind === 'milestone') {
    return [
      {
        id: 'none',
        value: null,
        label: 'No milestone',
        active: ('milestoneId' in current ? current.milestoneId : null) === null,
      },
      ...[...store.milestones.values()].map((milestone) => ({
        id: milestone.id,
        value: milestone.id,
        label: milestone.name,
        active: 'milestoneId' in current && current.milestoneId === milestone.id,
      })),
    ]
  }
  if (kind === 'duplicate') {
    const self = store.actionIssue()?.id
    return [...store.issues.values()]
      .filter((issue) => !issue.archivedAt && issue.id !== self)
      .slice(0, 50)
      .map((issue) => ({
        id: issue.id,
        value: issue.id,
        label: `${issue.identifier} ${issue.title}`,
        keywords: issue.description,
      }))
  }
  return [...store.teams.values()].map((team) => ({
    id: team.id,
    value: team.id,
    label: team.name,
    active: store.ui.composerOpen
      ? store.ui.composer.teamId === team.id
      : store.actionIssue()?.teamId === team.id,
  }))
}

function runProperty(
  store: NockStore,
  kind: PropertyMenuKind,
  value: string | number | null,
): void {
  if (kind === 'status') store.commands.run('issue.setStatus', { stateId: String(value) })
  else if (kind === 'priority') store.commands.run('issue.setPriority', { priority: value })
  else if (kind === 'assignee') store.commands.run('issue.setAssignee', { assigneeId: value })
  else if (kind === 'project') store.commands.run('issue.setProject', { projectId: value })
  else if (kind === 'cycle') store.commands.run('issue.setCycle', { cycleId: value })
  else if (kind === 'milestone') store.commands.run('issue.setMilestone', { milestoneId: value })
  else if (kind === 'team') store.commands.run('issue.moveTeam', { teamId: String(value) })
  else if (kind === 'label') {
    const labelId = String(value)
    const ids = store.ui.composerOpen
      ? store.ui.composer.labelIds
      : (store.actionIssue()?.labelIds ?? [])
    store.commands.run(
      ids.includes(labelId) ? 'issue.removeLabel' : 'issue.addLabel',
      { labelId },
    )
  } else if (kind === 'duplicate' && value) {
    store.commands.run('issue.duplicateTriage', { issueId: String(value) })
  }
}
