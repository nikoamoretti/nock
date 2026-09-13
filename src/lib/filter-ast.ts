import {
  EMPTY_AST,
  EMPTY_FILTERS,
  FILTER_UNASSIGNED,
  type FilterAst,
  type FilterClause,
  type FilterField,
  type Issue,
  type IssueFilters,
} from './types'

export function astFromFilters(filters: IssueFilters): FilterAst {
  const nodes: FilterAst[] = []
  if (filters.assigneeId)
    nodes.push(clause('assigneeId', filters.assigneeId))
  if (filters.stateId) nodes.push(clause('stateId', filters.stateId))
  if (filters.priority !== null)
    nodes.push(clause('priority', filters.priority))
  if (filters.projectId) nodes.push(clause('projectId', filters.projectId))
  if (filters.cycleId) nodes.push(clause('cycleId', filters.cycleId))
  if (nodes.length === 0) return { type: 'all' }
  if (nodes.length === 1) return nodes[0]
  return { type: 'and', nodes }
}

export function filtersFromAst(ast: FilterAst): IssueFilters {
  const filters = { ...EMPTY_FILTERS }
  for (const clauseNode of flattenClauses(ast)) {
    if (clauseNode.op !== 'eq') continue
    assignFilter(filters, clauseNode)
  }
  return filters
}

export function matchFilterAst(issue: Issue, ast: FilterAst): boolean {
  switch (ast.type) {
    case 'all':
      return true
    case 'and':
      return ast.nodes.every((node) => matchFilterAst(issue, node))
    case 'or':
      return ast.nodes.some((node) => matchFilterAst(issue, node))
    case 'clause':
      return matchClause(issue, ast.clause)
  }
}

export function flattenClauses(ast: FilterAst): FilterClause[] {
  if (ast.type === 'all') return []
  if (ast.type === 'clause') return [ast.clause]
  return ast.nodes.flatMap(flattenClauses)
}

export function combineFilterRoot(
  ast: FilterAst,
  type: 'and' | 'or',
): FilterAst {
  if (ast.type === 'all') return ast
  if (ast.type === type) return ast
  if (ast.type === 'clause') return { type, nodes: [ast] }
  return { type, nodes: ast.nodes }
}

function clause(field: FilterField, value: string | number): FilterAst {
  return { type: 'clause', clause: { field, op: 'eq', value } }
}

function matchClause(issue: Issue, clause: FilterClause): boolean {
  const left = valueFor(issue, clause.field)
  const hit = Array.isArray(left)
    ? left.includes(String(clause.value))
    : left === clause.value
  return clause.op === 'neq' ? !hit : hit
}

function valueFor(
  issue: Issue,
  field: FilterField,
): string | number | null | string[] {
  if (field === 'labelId') return issue.labelIds
  if (field === 'assigneeId') return issue.assigneeId ?? FILTER_UNASSIGNED
  if (field === 'stateId') return issue.stateId
  if (field === 'priority') return issue.priority
  if (field === 'projectId') return issue.projectId
  return issue.cycleId
}

function assignFilter(filters: IssueFilters, clause: FilterClause): void {
  if (clause.field === 'assigneeId' && typeof clause.value === 'string') {
    filters.assigneeId = clause.value
  }
  if (clause.field === 'stateId' && typeof clause.value === 'string') {
    filters.stateId = clause.value
  }
  if (clause.field === 'priority' && typeof clause.value === 'number') {
    filters.priority = clause.value as IssueFilters['priority']
  }
  if (clause.field === 'projectId' && typeof clause.value === 'string') {
    filters.projectId = clause.value
  }
  if (clause.field === 'cycleId' && typeof clause.value === 'string') {
    filters.cycleId = clause.value
  }
}

export { EMPTY_AST }
