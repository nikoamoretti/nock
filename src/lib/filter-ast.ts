import {
  EMPTY_AST,
  EMPTY_FILTERS,
  FILTER_UNASSIGNED,
  type FilterAst,
  type FilterClause,
  type FilterField,
  type FilterOp,
  type Issue,
  type IssueFilters,
} from './types'

export const FILTER_MAX_DEPTH = 8
export const FILTER_MAX_NODES = 40

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
      return ast.nodes.length === 0
        ? true
        : ast.nodes.some((node) => matchFilterAst(issue, node))
    case 'clause':
      return matchClause(issue, ast.clause)
  }
}

export function flattenClauses(ast: FilterAst): FilterClause[] {
  if (ast.type === 'all') return []
  if (ast.type === 'clause') return [ast.clause]
  return ast.nodes.flatMap(flattenClauses)
}

export function filterAstActive(ast: FilterAst): boolean {
  return flattenClauses(ast).length > 0
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

export function clauseMatches(
  clause: FilterClause,
  field: FilterField,
  value: string | number | null,
  op: FilterOp = 'eq',
): boolean {
  return clause.field === field && clause.op === op && clause.value === value
}

export function hasClause(
  ast: FilterAst,
  field: FilterField,
  value: string | number | null,
  op: FilterOp = 'eq',
): boolean {
  return flattenClauses(ast).some((row) => clauseMatches(row, field, value, op))
}

export function fieldClauses(ast: FilterAst, field: FilterField): FilterClause[] {
  return flattenClauses(ast).filter((row) => row.field === field)
}

export function fieldIsMixed(ast: FilterAst, field: FilterField): boolean {
  const rows = fieldClauses(ast, field)
  return rows.length > 1 || rows.some((row) => row.op === 'neq')
}

export function addCondition(
  ast: FilterAst,
  next: FilterClause,
  combine: 'and' | 'or' = 'and',
): FilterAst {
  const node: FilterAst = { type: 'clause', clause: next }
  if (ast.type === 'all') {
    return combine === 'or' ? { type: 'or', nodes: [node] } : node
  }
  if (ast.type === combine) return prune({ type: ast.type, nodes: [...ast.nodes, node] })
  return prune({ type: 'and', nodes: [ast, node] })
}

export function removeCondition(
  ast: FilterAst,
  field: FilterField,
  value: string | number | null,
  op: FilterOp = 'eq',
): FilterAst {
  return prune(removeMatching(ast, field, value, op))
}

export function removeField(ast: FilterAst, field: FilterField): FilterAst {
  return prune(stripField(ast, field))
}

export function setFieldValue(
  ast: FilterAst,
  field: FilterField,
  value: string | number | null,
  combine: 'and' | 'or' = 'and',
): FilterAst {
  if (value === null) return removeField(ast, field)
  if (fieldIsMixed(ast, field)) {
    return hasClause(ast, field, value)
      ? removeCondition(ast, field, value)
      : addCondition(ast, { field, op: 'eq', value }, combine)
  }
  const cleared = removeField(ast, field)
  return addCondition(cleared, { field, op: 'eq', value }, combine)
}

export function toggleCondition(
  ast: FilterAst,
  field: FilterField,
  value: string | number | null,
  combine: 'and' | 'or' = 'and',
  op: FilterOp = 'eq',
): FilterAst {
  if (hasClause(ast, field, value, op)) return removeCondition(ast, field, value, op)
  return addCondition(ast, { field, op, value }, combine)
}

export function filterNodeCount(ast: FilterAst): number {
  if (ast.type === 'all') return 0
  if (ast.type === 'clause') return 1
  return 1 + ast.nodes.reduce((sum, node) => sum + filterNodeCount(node), 0)
}

export function filterDepth(ast: FilterAst, depth = 1): number {
  if (ast.type === 'all' || ast.type === 'clause') return depth
  return Math.max(depth, ...ast.nodes.map((node) => filterDepth(node, depth + 1)))
}

export function filterAstWithinLimits(ast: FilterAst): boolean {
  return filterDepth(ast) <= FILTER_MAX_DEPTH && filterNodeCount(ast) <= FILTER_MAX_NODES
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

function removeMatching(
  ast: FilterAst,
  field: FilterField,
  value: string | number | null,
  op: FilterOp,
): FilterAst {
  if (ast.type === 'all') return ast
  if (ast.type === 'clause') {
    return clauseMatches(ast.clause, field, value, op) ? { type: 'all' } : ast
  }
  return {
    type: ast.type,
    nodes: ast.nodes.map((node) => removeMatching(node, field, value, op)),
  }
}

function stripField(ast: FilterAst, field: FilterField): FilterAst {
  if (ast.type === 'all') return ast
  if (ast.type === 'clause') return ast.clause.field === field ? { type: 'all' } : ast
  return {
    type: ast.type,
    nodes: ast.nodes.map((node) => stripField(node, field)),
  }
}

function prune(ast: FilterAst): FilterAst {
  if (ast.type === 'all' || ast.type === 'clause') return ast
  const nodes = ast.nodes.map(prune).filter((node) => node.type !== 'all')
  if (nodes.length === 0) return { type: 'all' }
  if (nodes.length === 1) return nodes[0]
  return { type: ast.type, nodes }
}

export { EMPTY_AST }
