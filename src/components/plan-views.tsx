import { useNock } from '../hooks/use-nock'
import { formatRange } from '../lib/cn'
import { currentCycle } from '../lib/filters'
import { IssuePeek, IssueRow } from './issue-view'

export function ProjectsView() {
  const store = useNock()
  const projects = [...store.projects.values()]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-11 items-center border-b border-line px-4 text-[13px] font-medium"
      >
        Projects
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const progress = store.projectProgress(project.id)
            return (
              <article
                key={project.id}
                className="rounded-lg border border-line bg-side p-4"
              >
                <div className="text-[14px] font-medium">{project.name}</div>
                <p className="mt-1 text-[13px] leading-5 text-mute">
                  {project.description}
                </p>
                <div className="mt-4 flex items-center gap-3 text-[12px] text-mute">
                  <span className="capitalize">{project.status}</span>
                  <span>
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                  />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
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
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
      {store.peekedIssue() && <IssuePeek />}
    </div>
  )
}
