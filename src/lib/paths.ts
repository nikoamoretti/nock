import type { ViewId } from './types'

export type PathScope = {
  workspaceKey: string
  teamKey: string
}

export type ParsedAppPath = {
  workspaceKey: string
  teamKey: string | null
  view: ViewId
  identifier: string | null
  projectId: string | null
  cycleId: string | null
  initiativeId: string | null
  documentId: string | null
}

export type CanonicalLocation = {
  pathname: string
  search: string
}

const LEGACY_ROOTS = new Set([
  'inbox',
  'my-issues',
  'eng',
  'issues',
  'projects',
  'cycles',
  'initiatives',
])

const TEAM_VIEWS = new Set<ViewId>(['all', 'active', 'backlog', 'board'])

export function collectionPath(view: ViewId, scope: PathScope): string {
  const { workspaceKey: ws, teamKey: team } = scope
  switch (view) {
    case 'inbox':
      return `/${ws}/inbox`
    case 'my-issues':
      return `/${ws}/my-issues`
    case 'active':
      return `/${ws}/team/${team}/active`
    case 'backlog':
      return `/${ws}/team/${team}/backlog`
    case 'board':
      return `/${ws}/team/${team}/board`
    case 'projects':
      return `/${ws}/projects`
    case 'cycles':
      return `/${ws}/team/${team}/cycles`
    case 'initiatives':
      return `/${ws}/initiatives`
    default:
      return `/${ws}/team/${team}/all`
  }
}

export function issueFullPath(identifier: string, scope: PathScope): string {
  return `/${scope.workspaceKey}/issue/${identifier}`
}

export function issuePeekPath(
  view: ViewId,
  identifier: string,
  scope: PathScope,
): string {
  return `${collectionPath(view, scope)}/${identifier}`
}

export function projectPath(projectId: string, scope: PathScope): string {
  return `/${scope.workspaceKey}/project/${projectId}`
}

export function initiativePath(initiativeId: string, scope: PathScope): string {
  return `/${scope.workspaceKey}/initiative/${initiativeId}`
}

export function cyclePath(cycleId: string, scope: PathScope): string {
  return `/${scope.workspaceKey}/team/${scope.teamKey}/cycle/${cycleId}`
}

export function cyclesCurrentPath(scope: PathScope): string {
  return `/${scope.workspaceKey}/team/${scope.teamKey}/cycles/current`
}

export function documentPath(documentId: string, scope: PathScope): string {
  return `/${scope.workspaceKey}/document/${documentId}`
}

export function identifierFromPath(pathname: string): string | null {
  const parsed = parseAppPath(pathname)
  if (parsed?.identifier) return parsed.identifier
  const full = pathname.match(/^\/issues\/([^/]+)$/)
  if (full) return decodeURIComponent(full[1])
  const nested = pathname.match(/\/([A-Z]+-\d+)$/i)
  return nested ? nested[1] : null
}

export function parseAppPath(pathname: string): ParsedAppPath | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null
  if (parts[0] === '_ui' || LEGACY_ROOTS.has(parts[0])) return null
  const workspaceKey = parts[0]
  const empty = {
    workspaceKey,
    teamKey: null as string | null,
    identifier: null as string | null,
    projectId: null as string | null,
    cycleId: null as string | null,
    initiativeId: null as string | null,
    documentId: null as string | null,
  }

  if (parts[1] === 'team' && parts[2] && parts[3]) {
    const teamKey = parts[2]
    if (parts[3] === 'cycles') {
      const cycleId = parts[4] ?? null
      return {
        ...empty,
        teamKey,
        view: 'cycles',
        cycleId,
        identifier: issueIdent(parts[4]),
      }
    }
    if (parts[3] === 'cycle' && parts[4]) {
      return {
        ...empty,
        teamKey,
        view: 'cycles',
        cycleId: parts[4],
        identifier: issueIdent(parts[5]),
      }
    }
    const view = teamView(parts[3])
    if (!view) return null
    return {
      ...empty,
      teamKey,
      view,
      identifier: issueIdent(parts[4]),
    }
  }

  if (parts[1] === 'inbox') {
    return { ...empty, view: 'inbox', identifier: issueIdent(parts[2]) }
  }
  if (parts[1] === 'my-issues') {
    return { ...empty, view: 'my-issues', identifier: issueIdent(parts[2]) }
  }
  if (parts[1] === 'issue' && parts[2]) {
    return { ...empty, view: 'all', identifier: decodeURIComponent(parts[2]) }
  }
  if (parts[1] === 'projects') {
    return { ...empty, view: 'projects', projectId: parts[2] ?? null }
  }
  if (parts[1] === 'project' && parts[2]) {
    return { ...empty, view: 'projects', projectId: parts[2] }
  }
  if (parts[1] === 'initiatives') {
    return { ...empty, view: 'initiatives', initiativeId: parts[2] ?? null }
  }
  if (parts[1] === 'initiative' && parts[2]) {
    return { ...empty, view: 'initiatives', initiativeId: parts[2] }
  }
  if (parts[1] === 'cycles') {
    return { ...empty, view: 'cycles', cycleId: parts[2] ?? null }
  }
  if (parts[1] === 'document' && parts[2]) {
    return { ...empty, view: 'projects', documentId: parts[2] }
  }
  return null
}

export function isLegacyPath(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0]
  return Boolean(first && LEGACY_ROOTS.has(first))
}

export function migrateLegacyPath(pathname: string, scope: PathScope): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return collectionPath('projects', scope)
  const rest = (index: number) =>
    parts[index] ? `/${parts.slice(index).join('/')}` : ''

  switch (parts[0]) {
    case 'inbox':
      return `${collectionPath('inbox', scope)}${rest(1)}`
    case 'my-issues':
      return `${collectionPath('my-issues', scope)}${rest(1)}`
    case 'issues':
      return parts[1]
        ? issueFullPath(decodeURIComponent(parts[1]), scope)
        : collectionPath('all', scope)
    case 'eng': {
      const view = teamView(parts[1] ?? 'all') ?? 'all'
      const ident = issueIdent(parts[2])
      return ident
        ? issuePeekPath(view, ident, scope)
        : collectionPath(view, scope)
    }
    case 'projects':
      return parts[1]
        ? projectPath(parts[1], scope)
        : collectionPath('projects', scope)
    case 'cycles':
      if (parts[1] === 'current') return cyclesCurrentPath(scope)
      return parts[1]
        ? cyclePath(parts[1], scope)
        : collectionPath('cycles', scope)
    case 'initiatives':
      return parts[1]
        ? initiativePath(parts[1], scope)
        : collectionPath('initiatives', scope)
    default:
      return collectionPath('projects', scope)
  }
}

export function parseHashUrl(hash: string): { pathname: string; search: string } | null {
  if (!hash.startsWith('#/')) return null
  const raw = hash.slice(1)
  const q = raw.indexOf('?')
  if (q === -1) return { pathname: raw, search: '' }
  return { pathname: raw.slice(0, q), search: raw.slice(q) }
}

/** Hash-embedded query wins on conflicting keys; outer search fills the rest. */
export function mergeSearch(outer: string, inner: string): string {
  const a = new URLSearchParams(outer.startsWith('?') ? outer.slice(1) : outer)
  const b = new URLSearchParams(inner.startsWith('?') ? inner.slice(1) : inner)
  a.forEach((value, key) => {
    if (!b.has(key)) b.set(key, value)
  })
  const query = b.toString()
  return query ? `?${query}` : ''
}

export function canonicalizeLocation(
  pathname: string,
  search: string,
  hash: string,
  scope: PathScope,
): CanonicalLocation {
  const hashed = parseHashUrl(hash)
  const rawPath = hashed?.pathname || pathname || '/'
  const merged = mergeSearch(search, hashed?.search ?? '')
  if (isLegacyPath(rawPath) || rawPath === '/' || rawPath === '') {
    return {
      pathname: migrateLegacyPath(
        rawPath === '/' || rawPath === '' ? '/projects' : rawPath,
        scope,
      ),
      search: merged,
    }
  }
  const parsed = parseAppPath(rawPath)
  if (!parsed) {
    return {
      pathname: migrateLegacyPath('/projects', scope),
      search: merged,
    }
  }
  return { pathname: rawPath, search: merged }
}

export function canonicalizePath(
  pathname: string,
  hash: string,
  scope: PathScope,
): string {
  return canonicalizeLocation(pathname, '', hash, scope).pathname
}

export function locationNeedsCanonical(
  pathname: string,
  search: string,
  hash: string,
  scope: PathScope,
): CanonicalLocation | null {
  const next = canonicalizeLocation(pathname, search, hash, scope)
  const currentSearch = search.startsWith('?') || search === '' ? search : `?${search}`
  if (!hash.startsWith('#/') && next.pathname === pathname && next.search === currentSearch) {
    return null
  }
  if (hash.startsWith('#/')) return next
  if (next.pathname === pathname && next.search === currentSearch) return null
  return next
}

function teamView(segment: string | undefined): ViewId | null {
  if (!segment) return 'all'
  if (TEAM_VIEWS.has(segment as ViewId)) return segment as ViewId
  return null
}

function issueIdent(segment: string | undefined): string | null {
  if (!segment) return null
  return /^[A-Z]+-\d+$/i.test(segment) ? segment : null
}
