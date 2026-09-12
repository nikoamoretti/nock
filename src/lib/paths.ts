import type { ViewId } from './types'

export function collectionPath(view: ViewId): string {
  switch (view) {
    case 'inbox':
      return '/inbox'
    case 'my-issues':
      return '/my-issues'
    case 'active':
      return '/eng/active'
    case 'backlog':
      return '/eng/backlog'
    case 'board':
      return '/eng/board'
      case 'projects':
        return '/projects'
      case 'cycles':
        return '/cycles'
      case 'initiatives':
        return '/initiatives'
    default:
      return '/eng/all'
  }
}

export function issueFullPath(identifier: string): string {
  return `/issues/${identifier}`
}

export function issuePeekPath(view: ViewId, identifier: string): string {
  return `${collectionPath(view)}/${identifier}`
}

export function identifierFromPath(pathname: string): string | null {
  const full = pathname.match(/^\/issues\/([^/]+)$/)
  if (full) return decodeURIComponent(full[1])
  const nested = pathname.match(/\/([A-Z]+-\d+)$/i)
  return nested ? nested[1] : null
}
