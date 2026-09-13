import { astFromFilters, filtersFromAst } from './filter-ast'
import {
  EMPTY_AST,
  EMPTY_FILTERS,
  FILTER_UNASSIGNED,
  type FilterAst,
  type FilterClause,
  type FilterField,
  type FilterOp,
  type IssueFilters,
  type Priority,
} from './types'

const PRIORITIES = new Set<number>([0, 1, 2, 3, 4])
const FIELDS = new Set<FilterField>([
  'assigneeId',
  'stateId',
  'priority',
  'projectId',
  'cycleId',
  'labelId',
])
const OPS = new Set<FilterOp>(['eq', 'neq'])
export const FILTER_QUERY_VERSION = 1

export function filtersFromSearch(search: string): IssueFilters {
  const params = paramsOf(search)
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

export function encodeFilterAst(ast: FilterAst): string {
  if (ast.type === 'all') return ''
  return toBase64Url(JSON.stringify({ v: FILTER_QUERY_VERSION, ast }))
}

export function decodeFilterAst(payload: string): FilterAst | null {
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as {
      v?: number
      ast?: unknown
    }
    if (parsed.v !== FILTER_QUERY_VERSION) return null
    if (!isFilterAst(parsed.ast)) return null
    return parsed.ast
  } catch {
    return null
  }
}

export function astFromSearch(search: string): FilterAst {
  const params = paramsOf(search)
  const raw = params.get('filter')
  if (raw) {
    const ast = decodeFilterAst(raw)
    if (ast) return ast
  }
  return astFromFilters(filtersFromSearch(search))
}

export function searchFromAst(ast: FilterAst): string {
  const params = new URLSearchParams()
  const encoded = encodeFilterAst(ast)
  if (encoded) params.set('filter', encoded)
  const legacy = searchFromFilters(filtersFromAst(ast))
  if (legacy) {
    const extra = new URLSearchParams(legacy.slice(1))
    extra.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value)
    })
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function isFilterAst(value: unknown): value is FilterAst {
  if (!value || typeof value !== 'object') return false
  const node = value as FilterAst
  if (node.type === 'all') return true
  if (node.type === 'and' || node.type === 'or') {
    return Array.isArray(node.nodes) && node.nodes.every(isFilterAst)
  }
  if (node.type === 'clause') return isClause(node.clause)
  return false
}

function isClause(value: unknown): value is FilterClause {
  if (!value || typeof value !== 'object') return false
  const clause = value as FilterClause
  if (!FIELDS.has(clause.field) || !OPS.has(clause.op)) return false
  return (
    clause.value === null ||
    typeof clause.value === 'string' ||
    typeof clause.value === 'number'
  )
}

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(payload: string): string {
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export { EMPTY_AST }
