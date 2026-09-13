import {
  FILTER_UNASSIGNED,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  STATE_TYPE_ORDER,
  type FilterAst,
  type GroupBy,
  type Issue,
  type IssueFilters,
  type OrderBy,
  type Snapshot,
  type StateType,
  type ViewId,
  type WorkflowState,
} from './types'
import { filterAstActive, matchFilterAst } from './filter-ast'

export function stateById(
  states: WorkflowState[],
  id: string,
): WorkflowState | undefined {
  return states.find((state) => state.id === id)
}

export function isTeamScopedView(view: ViewId): boolean {
  return view === 'all' || view === 'active' || view === 'backlog' || view === 'board'
}

export function isOpenType(type: StateType): boolean {
  return (
    type === 'triage' ||
    type === 'backlog' ||
    type === 'unstarted' ||
    type === 'started'
  )
}

export function compareIssues(
  a: Issue,
  b: Issue,
  states: WorkflowState[],
  orderBy: OrderBy = 'status',
): number {
  if (orderBy === 'manual') return a.sortOrder - b.sortOrder
  if (orderBy === 'created') return b.createdAt - a.createdAt
  if (orderBy === 'updated') return b.updatedAt - a.updatedAt
  if (orderBy === 'priority') {
    const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (priority !== 0) return priority
    return a.sortOrder - b.sortOrder
  }
  const stateA = stateById(states, a.stateId)
  const stateB = stateById(states, b.stateId)
  const typeRank =
    STATE_TYPE_ORDER.indexOf(stateA?.type ?? 'backlog') -
    STATE_TYPE_ORDER.indexOf(stateB?.type ?? 'backlog')
  if (typeRank !== 0) return typeRank
  const pos = (stateA?.position ?? 0) - (stateB?.position ?? 0)
  if (pos !== 0) return pos
  const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (priority !== 0) return priority
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return b.updatedAt - a.updatedAt
}

export function filterIssues(
  source: {
    issues: readonly Issue[]
    states: readonly WorkflowState[]
    currentUserId: string
  },
  view: ViewId,
  orderBy: OrderBy = 'status',
): Issue[] {
  const { issues, states, currentUserId } = source
  return [...issues]
    .filter((issue) => {
      if (issue.archivedAt) return false
      const state = stateById([...states], issue.stateId)
      if (!state) return false
      switch (view) {
        case 'inbox':
          return state.type === 'triage'
        case 'my-issues':
          return issue.assigneeId === currentUserId && isOpenType(state.type)
        case 'active':
          return state.type === 'unstarted' || state.type === 'started'
        case 'board':
          return (
            state.type === 'backlog' ||
            state.type === 'unstarted' ||
            state.type === 'started' ||
            state.type === 'completed'
          )
        case 'backlog':
          return state.type === 'backlog'
        case 'all':
          return state.type !== 'triage'
        default:
          return true
      }
    })
    .sort((a, b) => compareIssues(a, b, [...states], orderBy))
}

export function groupByState(
  issues: Issue[],
  states: WorkflowState[],
): { state: WorkflowState; issues: Issue[] }[] {
  const groups = new Map<string, Issue[]>()
  for (const issue of issues) {
    const list = groups.get(issue.stateId) ?? []
    list.push(issue)
    groups.set(issue.stateId, list)
  }
  return [...states]
    .sort((a, b) => {
      const type =
        STATE_TYPE_ORDER.indexOf(a.type) - STATE_TYPE_ORDER.indexOf(b.type)
      if (type !== 0) return type
      return a.position - b.position
    })
    .map((state) => ({ state, issues: groups.get(state.id) ?? [] }))
    .filter((group) => group.issues.length > 0)
}

export function boardColumns(states: WorkflowState[]): WorkflowState[] {
  return [...states]
    .filter(
      (state) =>
        state.type === 'backlog' ||
        state.type === 'unstarted' ||
        state.type === 'started' ||
        state.type === 'completed',
    )
    .sort((a, b) => {
      const type =
        STATE_TYPE_ORDER.indexOf(a.type) - STATE_TYPE_ORDER.indexOf(b.type)
      if (type !== 0) return type
      return a.position - b.position
    })
}

export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const t = text.toLowerCase()
  if (t.includes(q)) return true
  let i = 0
  for (const ch of t) {
    if (ch === q[i]) i += 1
    if (i === q.length) return true
  }
  return false
}

export function applyExtraFilters(
  issues: Issue[],
  filters: IssueFilters,
  ast?: FilterAst,
): Issue[] {
  if (ast) {
    return issues.filter((issue) => matchFilterAst(issue, ast))
  }
  return issues.filter((issue) => {
    if (filters.stateId && issue.stateId !== filters.stateId) return false
    if (filters.priority !== null && issue.priority !== filters.priority)
      return false
    if (filters.projectId && issue.projectId !== filters.projectId) return false
    if (filters.cycleId && issue.cycleId !== filters.cycleId) return false
    if (filters.assigneeId === FILTER_UNASSIGNED) {
      if (issue.assigneeId !== null) return false
    } else if (filters.assigneeId && issue.assigneeId !== filters.assigneeId) {
      return false
    }
    return true
  })
}

export function filtersActive(
  filters: IssueFilters,
  ast?: FilterAst,
): boolean {
  if (ast) return filterAstActive(ast)
  return (
    filters.assigneeId !== null ||
    filters.stateId !== null ||
    filters.priority !== null ||
    filters.projectId !== null ||
    filters.cycleId !== null
  )
}

export type IssueGroup = {
  key: string
  label: string
  issues: Issue[]
  state?: WorkflowState
}

export function groupIssues(
  issues: Issue[],
  groupBy: GroupBy,
  lookup: {
    states: WorkflowState[]
    users: { id: string; name: string }[]
    projects: { id: string; name: string }[]
    cycles?: { id: string; number: number }[]
  },
): IssueGroup[] {
  if (groupBy === 'none') {
    return issues.length ? [{ key: 'all', label: 'Issues', issues }] : []
  }
  if (groupBy === 'status') {
    return groupByState(issues, lookup.states).map((group) => ({
      key: group.state.id,
      label: group.state.name,
      issues: group.issues,
      state: group.state,
    }))
  }
  if (groupBy === 'priority') {
    const order: Array<Issue['priority']> = [1, 2, 3, 4, 0]
    return order
      .map((priority) => ({
        key: `p${priority}`,
        label: PRIORITY_LABELS[priority],
        issues: issues.filter((issue) => issue.priority === priority),
      }))
      .filter((group) => group.issues.length > 0)
  }
  if (groupBy === 'assignee') {
    const groups: IssueGroup[] = []
    const unassigned = issues.filter((issue) => issue.assigneeId === null)
    if (unassigned.length) {
      groups.push({ key: 'unassigned', label: 'Unassigned', issues: unassigned })
    }
    for (const user of lookup.users) {
      const assigned = issues.filter((issue) => issue.assigneeId === user.id)
      if (assigned.length) {
        groups.push({ key: user.id, label: user.name, issues: assigned })
      }
    }
    return groups
  }
  if (groupBy === 'cycle') {
    const groups: IssueGroup[] = []
    for (const cycle of lookup.cycles ?? []) {
      const rows = issues.filter((issue) => issue.cycleId === cycle.id)
      if (rows.length) {
        groups.push({
          key: cycle.id,
          label: `Cycle ${cycle.number}`,
          issues: rows,
        })
      }
    }
    const none = issues.filter((issue) => !issue.cycleId)
    if (none.length) groups.push({ key: 'none', label: 'No cycle', issues: none })
    return groups
  }
  const byProject = new Map<string, Issue[]>()
  const none: Issue[] = []
  for (const issue of issues) {
    if (!issue.projectId) none.push(issue)
    else {
      const list = byProject.get(issue.projectId) ?? []
      list.push(issue)
      byProject.set(issue.projectId, list)
    }
  }
  const groups: IssueGroup[] = lookup.projects
    .filter((project) => byProject.has(project.id))
    .map((project) => ({
      key: project.id,
      label: project.name,
      issues: byProject.get(project.id) ?? [],
    }))
  if (none.length) groups.push({ key: 'none', label: 'No project', issues: none })
  return groups
}

export function currentCycle(
  cycles: Snapshot['cycles'],
  now = Date.now(),
): Snapshot['cycles'][number] | undefined {
  return cycles.find((cycle) => now >= cycle.startsAt && now <= cycle.endsAt)
}
