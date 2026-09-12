import { Link, useParams } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'
import { cn, formatRange, formatShortDate } from '../lib/cn'
import { currentCycle } from '../lib/filters'
import { HEALTH_LABELS, type Project, type ProjectHealth } from '../lib/types'
import { IssuePeek } from './issue-detail'
import { IssueRow } from './issue-list'

const HEALTH_TONE: Record<ProjectHealth, string> = {
  'on-track': 'text-success',
  'at-risk': 'text-warning',
  'off-track': 'text-danger',
  'no-update': 'text-muted',
}

export function ProjectsView() {
  const store = useNock()
  const projects = [...store.projects.values()].sort((a, b) => {
    const rank = healthRank(a.health) - healthRank(b.health)
    return rank !== 0 ? rank : a.name.localeCompare(b.name)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-11 items-center border-b border-line px-4 text-[13px] font-medium"
      >
        Projects
        <span className="ml-2 text-[12px] font-normal text-dim">
          {projects.length}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const store = useNock()
  const progress = store.projectProgress(project.id)
  const update = store.latestUpdate(project.id)
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
        {project.description}
      </p>
      {update && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-dim">
          {update.body}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 text-[12px] text-mute">
        <span className="capitalize">{project.status}</span>
        <span>
          {progress.completed}/{progress.total} issues
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
        <div
          className="h-full bg-accent"
          style={{ width: `${Math.round(progress.ratio * 100)}%` }}
        />
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
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-mute">
              {project.description}
            </p>
          </div>
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
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">
                      {update.body}
                    </p>
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

export function CyclesView() {
  const store = useNock()
  const cycle = currentCycle([...store.cycles.values()])
  const issues = cycle
    ? [...store.issues.values()].filter((issue) => issue.cycleId === cycle.id)
    : []

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className="flex h-11 items-center border-b border-line px-4 text-[13px] font-medium"
        >
          Cycles
        </header>
        {!cycle ? (
          <div className="flex flex-1 items-center justify-center text-mute">
            No active cycle
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-line px-4 py-4">
              <div className="text-[16px] font-medium">Cycle {cycle.number}</div>
              <div className="mt-1 text-[12px] text-mute">
                {formatRange(cycle.startsAt, cycle.endsAt)}
              </div>
            </div>
            {issues.map((issue) => (
              <IssueRow key={issue.id} issueId={issue.id} />
            ))}
          </div>
        )}
      </div>
      {store.peekedIssue() && <IssuePeek />}
    </div>
  )
}
