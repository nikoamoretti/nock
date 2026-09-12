import { isOpenType } from './filters'
import type {
  Cycle,
  Issue,
  Milestone,
  Project,
  ProjectHealth,
  WorkflowState,
} from './types'

export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS

export type CyclePhase = 'current' | 'upcoming' | 'completed'

export type TimelineZoom = 'week' | 'month' | 'quarter' | 'year'

export type TimelineWindow = {
  zoom: TimelineZoom
  start: number
  end: number
  columnMs: number
  columns: number
  todayOffset: number
}

export type DateRange = { startAt: number; targetAt: number }

const HEALTH_RANK: Record<ProjectHealth, number> = {
  'off-track': 0,
  'at-risk': 1,
  'on-track': 2,
  'no-update': 3,
}

const ZOOM: Record<TimelineZoom, { columnMs: number; columns: number }> = {
  week: { columnMs: DAY_MS, columns: 14 },
  month: { columnMs: WEEK_MS, columns: 10 },
  quarter: { columnMs: WEEK_MS * 2, columns: 13 },
  year: { columnMs: DAY_MS * 30, columns: 12 },
}

export function snapToDay(ts: number): number {
  const date = new Date(ts)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function cycleDurationMs(weeks = 2): number {
  return Math.max(1, weeks) * WEEK_MS
}

export function cyclePhase(
  cycle: Pick<Cycle, 'startsAt' | 'endsAt' | 'completedAt'>,
  now: number,
): CyclePhase {
  if (cycle.completedAt != null || now > cycle.endsAt) return 'completed'
  if (now < cycle.startsAt) return 'upcoming'
  return 'current'
}

export function classifyCycles(
  cycles: Cycle[],
  now: number,
): Record<CyclePhase, Cycle[]> {
  const groups: Record<CyclePhase, Cycle[]> = {
    current: [],
    upcoming: [],
    completed: [],
  }
  for (const cycle of cycles) groups[cyclePhase(cycle, now)].push(cycle)
  groups.current.sort((a, b) => a.startsAt - b.startsAt)
  groups.upcoming.sort((a, b) => a.startsAt - b.startsAt)
  groups.completed.sort((a, b) => b.endsAt - a.endsAt)
  return groups
}

function stateMap(states: WorkflowState[]): Map<string, WorkflowState> {
  return new Map(states.map((state) => [state.id, state]))
}

export function cycleProgress(
  cycleId: string,
  issues: Issue[],
  states: WorkflowState[],
): { total: number; completed: number; ratio: number } {
  const map = stateMap(states)
  const scoped = issues.filter((issue) => issue.cycleId === cycleId && !issue.archivedAt)
  const completed = scoped.filter((issue) => map.get(issue.stateId)?.type === 'completed').length
  return {
    total: scoped.length,
    completed,
    ratio: scoped.length === 0 ? 0 : completed / scoped.length,
  }
}

export function cycleCapacity(
  cycles: Cycle[],
  issues: Issue[],
  states: WorkflowState[],
  lookback = 3,
  now = Date.now(),
): number {
  const completedCycles = classifyCycles(cycles, now).completed.slice(0, lookback)
  if (completedCycles.length === 0) return 0
  const map = stateMap(states)
  const counts = completedCycles.map(
    (cycle) =>
      issues.filter(
        (issue) =>
          issue.cycleId === cycle.id &&
          !issue.archivedAt &&
          map.get(issue.stateId)?.type === 'completed',
      ).length,
  )
  return Math.round(counts.reduce((sum, n) => sum + n, 0) / counts.length)
}

export function cycleProgressGraph(
  cycle: Cycle,
  issues: Issue[],
  states: WorkflowState[],
): Array<{ at: number; completed: number }> {
  const map = stateMap(states)
  const start = snapToDay(cycle.startsAt)
  const end = snapToDay(cycle.endsAt)
  const done = issues.filter(
    (issue) =>
      issue.cycleId === cycle.id &&
      !issue.archivedAt &&
      map.get(issue.stateId)?.type === 'completed',
  )
  const points: Array<{ at: number; completed: number }> = []
  let completed = 0
  for (let at = start; at <= end; at += DAY_MS) {
    completed += done.filter((issue) => snapToDay(issue.updatedAt) === at).length
    points.push({ at, completed })
  }
  return points
}

export function scopeChanges(
  baselineIssueIds: string[],
  currentIssueIds: string[],
): { added: string[]; removed: string[] } {
  const baseline = new Set(baselineIssueIds)
  const current = new Set(currentIssueIds)
  return {
    added: currentIssueIds.filter((id) => !baseline.has(id)),
    removed: baselineIssueIds.filter((id) => !current.has(id)),
  }
}

export function rolloverCycle(input: {
  cycle: Cycle
  issues: Issue[]
  states: WorkflowState[]
  now: number
  durationWeeks?: number
}): { completed: Cycle; next: Cycle; moved: Issue[] } {
  const duration = cycleDurationMs(input.durationWeeks)
  const next: Cycle = {
    id: `cycle_${input.cycle.teamId}_${input.cycle.number + 1}`,
    teamId: input.cycle.teamId,
    number: input.cycle.number + 1,
    startsAt: input.cycle.endsAt,
    endsAt: input.cycle.endsAt + duration,
    completedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
    syncId: input.cycle.syncId + 1,
    scopeIssueIds: [],
  }
  const map = stateMap(input.states)
  const moved = input.issues
    .filter((row) => {
      if (row.cycleId !== input.cycle.id || row.archivedAt) return false
      const type = map.get(row.stateId)?.type
      return type ? isOpenType(type) : true
    })
    .map((row) => ({ ...row, cycleId: next.id, updatedAt: input.now }))
  next.scopeIssueIds = moved.map((row) => row.id)
  return {
    completed: { ...input.cycle, completedAt: input.now, updatedAt: input.now },
    next,
    moved,
  }
}

export function moveRange(startAt: number, targetAt: number, deltaMs: number): DateRange {
  const span = targetAt - startAt
  const start = snapToDay(startAt + deltaMs)
  return { startAt: start, targetAt: start + span }
}

export function resizeRange(
  startAt: number,
  targetAt: number,
  edge: 'start' | 'end',
  deltaMs: number,
): DateRange {
  const start = edge === 'start' ? snapToDay(startAt + deltaMs) : snapToDay(startAt)
  const end = edge === 'end' ? snapToDay(targetAt + deltaMs) : snapToDay(targetAt)
  if (end <= start) return { startAt: start, targetAt: start + DAY_MS }
  return { startAt: start, targetAt: end }
}

export function timelineWindow(now: number, zoom: TimelineZoom): TimelineWindow {
  const spec = ZOOM[zoom]
  const start = snapToDay(now - Math.floor(spec.columns / 3) * spec.columnMs)
  const end = start + spec.columns * spec.columnMs
  const today = Math.min(Math.max(now, start), end)
  return {
    zoom,
    start,
    end,
    columnMs: spec.columnMs,
    columns: spec.columns,
    todayOffset: (today - start) / (end - start),
  }
}

export function rangeStyle(
  range: { startAt: number | null; targetAt: number | null },
  window: TimelineWindow,
): { left: string; width: string } | null {
  if (range.startAt == null || range.targetAt == null) return null
  const span = window.end - window.start
  const left = ((range.startAt - window.start) / span) * 100
  const width = ((range.targetAt - range.startAt) / span) * 100
  return {
    left: `${Math.max(-10, left)}%`,
    width: `${Math.max(1.5, width)}%`,
  }
}

export function deltaMsFromPixels(
  dx: number,
  widthPx: number,
  window: TimelineWindow,
): number {
  if (widthPx <= 0) return 0
  return (dx / widthPx) * (window.end - window.start)
}

export function dependencyInvalid(
  source: { targetAt?: number | null },
  target: { startAt?: number | null },
): boolean {
  if (source.targetAt == null || target.startAt == null) return false
  return target.startAt < source.targetAt
}

export function milestoneCompletion(
  milestoneId: string,
  issues: Issue[],
  states: WorkflowState[],
): number {
  const map = stateMap(states)
  const scoped = issues.filter((issue) => issue.milestoneId === milestoneId && !issue.archivedAt)
  if (scoped.length === 0) return 0
  const completed = scoped.filter((issue) => map.get(issue.stateId)?.type === 'completed').length
  return completed / scoped.length
}

export function normalizeProject(project: Project): Project {
  return {
    ...project,
    summary: project.summary ?? '',
    leadId: project.leadId ?? null,
    startAt: project.startAt ?? null,
    targetAt: project.targetAt ?? null,
    teamIds:
      project.teamIds && project.teamIds.length > 0
        ? [...project.teamIds]
        : project.teamId
          ? [project.teamId]
          : [],
    memberIds: [...(project.memberIds ?? [])],
    blockedByIds: [...(project.blockedByIds ?? [])],
  }
}

export function normalizeCycle(cycle: Cycle): Cycle {
  return {
    ...cycle,
    completedAt: cycle.completedAt ?? null,
    scopeIssueIds: [...(cycle.scopeIssueIds ?? [])],
  }
}

export function normalizeMilestone(milestone: Milestone): Milestone {
  return {
    ...milestone,
    targetAt: milestone.targetAt ?? null,
  }
}

export function initiativeRollup(
  projectIds: string[],
  projects: Project[],
  issues: Issue[],
  states: WorkflowState[],
): {
  health: ProjectHealth
  progress: { total: number; completed: number; ratio: number }
} {
  const members = projects.filter((project) => projectIds.includes(project.id))
  const health = members.reduce<ProjectHealth>((worst, project) => {
    return HEALTH_RANK[project.health] < HEALTH_RANK[worst] ? project.health : worst
  }, 'no-update')
  const map = stateMap(states)
  const scoped = issues.filter(
    (issue) => issue.projectId && projectIds.includes(issue.projectId) && !issue.archivedAt,
  )
  const completed = scoped.filter((issue) => map.get(issue.stateId)?.type === 'completed').length
  return {
    health: members.length === 0 ? 'no-update' : health,
    progress: {
      total: scoped.length,
      completed,
      ratio: scoped.length === 0 ? 0 : completed / scoped.length,
    },
  }
}
