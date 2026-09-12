import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn, formatRange, formatShortDate } from '../lib/cn'
import { currentCycle } from '../lib/filters'
import {
  cycleCapacity,
  cycleProgress,
  cycleProgressGraph,
  initiativeRollup,
  milestoneCompletion,
  scopeChanges,
  type TimelineZoom,
} from '../lib/planning'
import {
  HEALTH_LABELS,
  type Cycle,
  type Initiative,
  type Project,
  type ProjectHealth,
} from '../lib/types'
import { IssuePeek } from './issue-detail'
import { IssueRow } from './issue-list'
import { TimelineEngine, type TimelineRow } from './timeline-engine'

const HEALTH_TONE: Record<ProjectHealth, string> = {
  'on-track': 'text-success',
  'at-risk': 'text-warning',
  'off-track': 'text-danger',
  'no-update': 'text-muted',
}

export function ProjectsView() {
  const store = useNock()
  const [layout, setLayout] = useState<'list' | 'timeline'>('list')
  const [zoom, setZoom] = useState<TimelineZoom>('month')
  const projects = [...store.projects.values()].sort((a, b) => {
    const rank = healthRank(a.health) - healthRank(b.health)
    return rank !== 0 ? rank : a.name.localeCompare(b.name)
  })
  const rows: TimelineRow[] = projects.map((project) => ({
    id: project.id,
    label: project.name,
    href: `/projects/${project.id}`,
    startAt: project.startAt,
    targetAt: project.targetAt,
    milestones: store.milestonesFor(project.id),
    blockedByIds: project.blockedByIds,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-11 items-center gap-3 border-b border-line px-4 text-[13px] font-medium"
      >
        Projects
        <span className="text-[12px] font-normal text-dim">{projects.length}</span>
        <LayoutToggle layout={layout} onChange={setLayout} />
      </header>
      {layout === 'timeline' ? (
        <TimelineEngine
          rows={rows}
          zoom={zoom}
          onZoom={setZoom}
          onChange={(id, startAt, targetAt) => store.setProjectDates(id, startAt, targetAt)}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const store = useNock()
  const progress = store.projectProgress(project.id)
  const update = store.latestUpdate(project.id)
  const lead = project.leadId ? store.users.get(project.leadId) : null
  return (
    <Link
      to={`/projects/${project.id}`}
      className="rounded-lg border border-line bg-side p-4 hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{project.name}</div>
          <div className="mt-0.5 text-[12px] text-dim">{project.area}</div>
        </div>
        <HealthBadge health={project.health} />
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-mute">
        {project.summary || project.description}
      </p>
      {update && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-dim">{update.body}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-mute">
        <span className="capitalize">{project.status}</span>
        {lead && <span>Lead {lead.name}</span>}
        {project.startAt && project.targetAt && (
          <span>{formatRange(project.startAt, project.targetAt)}</span>
        )}
        <span>
          {progress.completed}/{progress.total} issues
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
        <div className="h-full bg-accent" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </div>
    </Link>
  )
}

export function ProjectDetail() {
  const store = useNock()
  const { projectId = '' } = useParams()
  const project = store.projects.get(projectId)
  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-mute">
        Project not found
      </div>
    )
  }
  const updates = store.updatesForProject(project.id)
  const issues = store.issuesForProject(project.id)
  const milestones = store.milestonesFor(project.id)
  const documents = store.documentsFor(project.id)
  const lead = project.leadId ? store.users.get(project.leadId) : null
  const teams = project.teamIds
    .map((id) => store.teams.get(id))
    .filter((team): team is NonNullable<typeof team> => Boolean(team))
  const members = project.memberIds
    .map((id) => store.users.get(id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 items-center gap-3 border-b border-line px-4"
        >
          <Link to="/projects" className="text-[12px] text-mute hover:text-ink">
            Projects
          </Link>
          <span className="text-dim">/</span>
          <div className="min-w-0 truncate text-[13px] font-medium">{project.name}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="border-b border-line px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[16px] font-medium">{project.name}</h1>
              <HealthBadge health={project.health} />
              <span className="text-[12px] capitalize text-mute">{project.status}</span>
              <span className="text-[12px] text-dim">{project.area}</span>
            </div>
            {project.summary && (
              <p className="mt-2 text-[13px] leading-5 text-ink">{project.summary}</p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-mute">
              {project.description}
            </p>
            <dl className="mt-3 grid gap-2 text-[12px] text-mute sm:grid-cols-2">
              <div>Lead {lead?.name ?? 'Unassigned'}</div>
              <div>Teams {teams.map((team) => team.name).join(', ') || '—'}</div>
              <div>Members {members.map((user) => user.name).join(', ') || '—'}</div>
              <div>
                Dates{' '}
                {project.startAt && project.targetAt
                  ? formatRange(project.startAt, project.targetAt)
                  : 'Not scheduled'}
              </div>
            </dl>
          </div>
          <section className="border-b border-line px-4 py-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">
              Milestones
            </div>
            {milestones.length === 0 ? (
              <div className="text-[13px] text-mute">No milestones</div>
            ) : (
              <div className="space-y-2">
                {milestones.map((milestone) => {
                  const ratio = milestoneCompletion(
                    milestone.id,
                    issues,
                    [...store.states.values()],
                  )
                  return (
                    <div key={milestone.id} className="flex items-center gap-3 text-[13px]">
                      <div className="min-w-0 flex-1 truncate">{milestone.name}</div>
                      <div className="text-[12px] text-mute">
                        {milestone.targetAt ? formatShortDate(milestone.targetAt) : 'No date'}
                      </div>
                      <div className="w-24 text-[12px] text-mute">
                        {Math.round(ratio * 100)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          <section className="border-b border-line px-4 py-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">
              Documents
            </div>
            {documents.length === 0 ? (
              <div className="text-[13px] text-mute">No documents</div>
            ) : (
              documents.map((doc) => (
                <article key={doc.id} className="mb-2 rounded-md border border-line bg-side px-3 py-2">
                  <div className="text-[13px] font-medium">{doc.title}</div>
                  <p className="mt-1 line-clamp-3 text-[12px] text-mute">{doc.body}</p>
                </article>
              ))
            )}
          </section>
          <section className="border-b border-line px-4 py-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">
              Updates
            </div>
            {updates.length === 0 ? (
              <div className="text-[13px] text-mute">No updates yet</div>
            ) : (
              <div className="space-y-3">
                {updates.map((update) => (
                  <article key={update.id} className="rounded-md border border-line bg-side px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-mute">
                      <HealthBadge health={update.health} />
                      <span>{formatShortDate(update.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">{update.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-dim">
              Issues · {issues.length}
            </div>
            {issues.length === 0 ? (
              <div className="px-4 py-6 text-[13px] text-mute">No issues in this project</div>
            ) : (
              issues.map((issue) => <IssueRow key={issue.id} issueId={issue.id} />)
            )}
          </section>
        </div>
      </div>
      {store.peekedIssue() && <IssuePeek />}
    </div>
  )
}

export function CyclesView() {
  const store = useNock()
  const now = Date.now()
  const groups = store.classifiedCycles(now)
  const current = groups.current[0] ?? currentCycle([...store.cycles.values()], now)
  const capacity = cycleCapacity(
    [...store.cycles.values()],
    [...store.issues.values()],
    [...store.states.values()],
    3,
    now,
  )

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 items-center gap-3 border-b border-line px-4 text-[13px] font-medium"
        >
          Cycles
          <Link to="/cycles/current" className="text-[12px] font-normal text-accent hover:underline">
            Current cycle
          </Link>
          <button
            type="button"
            className="ml-auto rounded-md px-2 py-1 text-[12px] font-normal text-mute hover:bg-hover hover:text-ink"
            onClick={() => store.rolloverEndedCycles()}
          >
            Rollover ended
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-4 text-[12px] text-mute">
            Capacity from recent cycles: {capacity} issues
          </div>
          <CycleSection title="Current" cycles={groups.current} fallback={current} />
          <CycleSection title="Upcoming" cycles={groups.upcoming} />
          <CycleSection title="Completed" cycles={groups.completed} />
        </div>
      </div>
      {store.peekedIssue() && <IssuePeek />}
    </div>
  )
}

export function CycleDetail() {
  const store = useNock()
  const { cycleId = '' } = useParams()
  const cycle =
    cycleId === 'current'
      ? currentCycle([...store.cycles.values()])
      : store.cycles.get(cycleId)
  if (!cycle) return <Navigate to="/cycles" replace />
  return <CycleIssueView cycle={cycle} />
}

function CycleSection({
  title,
  cycles,
  fallback,
}: {
  title: string
  cycles: Cycle[]
  fallback?: Cycle
}) {
  const rows = cycles.length > 0 ? cycles : fallback ? [fallback] : []
  if (title !== 'Current' && rows.length === 0) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">{title}</h2>
        <div className="text-[13px] text-mute">None</div>
      </section>
    )
  }
  if (rows.length === 0) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">{title}</h2>
        <div className="text-[13px] text-mute">No active cycle</div>
      </section>
    )
  }
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-dim">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((cycle) => (
          <CycleCard key={cycle.id} cycle={cycle} />
        ))}
      </div>
    </section>
  )
}

function CycleCard({ cycle }: { cycle: Cycle }) {
  const store = useNock()
  const issues = store.issuesForCycle(cycle.id)
  const progress = cycleProgress(cycle.id, issues, [...store.states.values()])
  return (
    <Link
      to={`/cycles/${cycle.id}`}
      className="rounded-lg border border-line bg-side p-4 hover:border-accent/40"
      data-testid={`cycle-card-${cycle.id}`}
    >
      <div className="text-[14px] font-medium">Cycle {cycle.number}</div>
      <div className="mt-1 text-[12px] text-mute">{formatRange(cycle.startsAt, cycle.endsAt)}</div>
      <div className="mt-3 text-[12px] text-mute">
        {progress.completed}/{progress.total} done
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
        <div className="h-full bg-accent" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </div>
    </Link>
  )
}

function CycleIssueView({ cycle }: { cycle: Cycle }) {
  const store = useNock()
  const issues = store.issuesForCycle(cycle.id)
  const states = [...store.states.values()]
  const graph = cycleProgressGraph(cycle, issues, states)
  const max = Math.max(1, ...graph.map((point) => point.completed))
  const currentIds = issues.map((issue) => issue.id)
  const scope = scopeChanges(cycle.scopeIssueIds, currentIds)

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 items-center gap-3 border-b border-line px-4"
        >
          <Link to="/cycles" className="text-[12px] text-mute hover:text-ink">
            Cycles
          </Link>
          <span className="text-dim">/</span>
          <div className="text-[13px] font-medium">Cycle {cycle.number}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="border-b border-line px-4 py-4">
            <div className="text-[16px] font-medium">Cycle {cycle.number}</div>
            <div className="mt-1 text-[12px] text-mute">{formatRange(cycle.startsAt, cycle.endsAt)}</div>
            {(scope.added.length > 0 || scope.removed.length > 0) && (
              <div className="mt-2 text-[12px] text-mute" data-testid="cycle-scope">
                Scope {scope.added.length} added · {scope.removed.length} removed
              </div>
            )}
            <svg viewBox="0 0 240 64" className="mt-3 h-16 w-full max-w-md text-accent">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points={graph
                  .map((point, index) => {
                    const x = graph.length <= 1 ? 0 : (index / (graph.length - 1)) * 240
                    const y = 60 - (point.completed / max) * 52
                    return `${x},${y}`
                  })
                  .join(' ')}
              />
            </svg>
          </div>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issueId={issue.id} />
          ))}
        </div>
      </div>
      {store.peekedIssue() && <IssuePeek />}
    </div>
  )
}

export function InitiativesView() {
  const store = useNock()
  const [layout, setLayout] = useState<'list' | 'timeline'>('list')
  const [zoom, setZoom] = useState<TimelineZoom>('quarter')
  const initiatives = [...store.initiatives.values()].sort((a, b) => a.name.localeCompare(b.name))
  const rows: TimelineRow[] = initiatives.map((initiative) => {
    const projects = initiative.projectIds
      .map((id) => store.projects.get(id))
      .filter((project): project is Project => Boolean(project))
    const starts = projects.map((project) => project.startAt).filter((value): value is number => value != null)
    const ends = projects.map((project) => project.targetAt).filter((value): value is number => value != null)
    return {
      id: initiative.id,
      label: initiative.name,
      href: `/initiatives/${initiative.id}`,
      startAt: starts.length ? Math.min(...starts) : initiative.targetAt,
      targetAt: ends.length ? Math.max(...ends) : initiative.targetAt,
      blockedByIds: [],
    }
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-11 items-center gap-3 border-b border-line px-4 text-[13px] font-medium"
      >
        Initiatives
        <span className="text-[12px] font-normal text-dim">{initiatives.length}</span>
        <LayoutToggle layout={layout} onChange={setLayout} />
      </header>
      {layout === 'timeline' ? (
        <TimelineEngine
          rows={rows}
          zoom={zoom}
          onZoom={setZoom}
          onChange={(id, _startAt, targetAt) => store.updateInitiative(id, { targetAt })}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {initiatives.map((initiative) => (
              <InitiativeCard key={initiative.id} initiative={initiative} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function InitiativeDetail() {
  const store = useNock()
  const { initiativeId = '' } = useParams()
  const initiative = store.initiatives.get(initiativeId)
  if (!initiative) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-mute">
        Initiative not found
      </div>
    )
  }
  const owner = initiative.ownerId ? store.users.get(initiative.ownerId) : null
  const team = initiative.leadTeamId ? store.teams.get(initiative.leadTeamId) : null
  const rollup = initiativeRollup(
    initiative.projectIds,
    [...store.projects.values()],
    [...store.issues.values()],
    [...store.states.values()],
  )
  const projects = initiative.projectIds
    .map((id) => store.projects.get(id))
    .filter((project): project is Project => Boolean(project))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-11 items-center gap-3 border-b border-line px-4"
      >
        <Link to="/initiatives" className="text-[12px] text-mute hover:text-ink">
          Initiatives
        </Link>
        <span className="text-dim">/</span>
        <div className="min-w-0 truncate text-[13px] font-medium">{initiative.name}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <h1 className="text-[16px] font-medium">{initiative.name}</h1>
        <p className="mt-2 text-[13px] text-mute">{initiative.description}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-mute">
          <span>Owner {owner?.name ?? 'Unassigned'}</span>
          <span>Lead team {team?.name ?? '—'}</span>
          <span className="capitalize">{initiative.status}</span>
          <HealthBadge health={rollup.health} />
          <span>
            {rollup.progress.completed}/{rollup.progress.total} issues
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}

function InitiativeCard({ initiative }: { initiative: Initiative }) {
  const store = useNock()
  const rollup = initiativeRollup(
    initiative.projectIds,
    [...store.projects.values()],
    [...store.issues.values()],
    [...store.states.values()],
  )
  const owner = initiative.ownerId ? store.users.get(initiative.ownerId) : null
  return (
    <Link
      to={`/initiatives/${initiative.id}`}
      className="rounded-lg border border-line bg-side p-4 hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{initiative.name}</div>
          <div className="mt-0.5 text-[12px] text-dim">
            {owner?.name ?? 'Unassigned'} · {initiative.projectIds.length} projects
          </div>
        </div>
        <HealthBadge health={rollup.health} />
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-mute">{initiative.description}</p>
      <div className="mt-4 text-[12px] text-mute">
        {rollup.progress.completed}/{rollup.progress.total} issues
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
        <div
          className="h-full bg-accent"
          style={{ width: `${Math.round(rollup.progress.ratio * 100)}%` }}
        />
      </div>
    </Link>
  )
}

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: 'list' | 'timeline'
  onChange: (layout: 'list' | 'timeline') => void
}) {
  return (
    <div className="ml-auto flex rounded-md border border-line text-[12px] font-normal">
      <button
        type="button"
        className={cn('px-2 py-1', layout === 'list' ? 'bg-hover text-ink' : 'text-mute')}
        onClick={() => onChange('list')}
      >
        List
      </button>
      <button
        type="button"
        data-testid="timeline-layout"
        className={cn('px-2 py-1', layout === 'timeline' ? 'bg-hover text-ink' : 'text-mute')}
        onClick={() => onChange('timeline')}
      >
        Timeline
      </button>
    </div>
  )
}

function HealthBadge({ health }: { health: ProjectHealth }) {
  return (
    <span className={cn('shrink-0 text-[11px] font-medium', HEALTH_TONE[health])}>
      {HEALTH_LABELS[health]}
    </span>
  )
}

function healthRank(health: ProjectHealth): number {
  return { 'off-track': 0, 'at-risk': 1, 'on-track': 2, 'no-update': 3 }[health]
}