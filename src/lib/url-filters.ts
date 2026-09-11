import {
  EMPTY_FILTERS,
  FILTER_UNASSIGNED,
  type IssueFilters,
  type Priority,
} from './types'

const PRIORITIES = new Set<number>([0, 1, 2, 3, 4])

export function filtersFromSearch(search: string): IssueFilters {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  const assignee = params.get('assignee')
  const priorityRaw = params.get('priority')
  let priority: Priority | null = null
  if (priorityRaw !== null) {
    const n = Number(priorityRaw)
    if (PRIORITIES.has(n)) priority = n as Priority
  }
  return {
    ...EMPTY_FILTERS,
    assigneeId: assignee === 'none' ? FILTER_UNASSIGNED : assignee,
    stateId: params.get('status'),
    priority,
    projectId: params.get('project'),
    cycleId: params.get('cycle'),
  }
}

export function searchFromFilters(filters: IssueFilters): string {
  const params = new URLSearchParams()
  if (filters.assigneeId === FILTER_UNASSIGNED) params.set('assignee', 'none')
  else if (filters.assigneeId) params.set('assignee', filters.assigneeId)
  if (filters.stateId) params.set('status', filters.stateId)
  if (filters.priority !== null) params.set('priority', String(filters.priority))
  if (filters.projectId) params.set('project', filters.projectId)
  if (filters.cycleId) params.set('cycle', filters.cycleId)
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}
