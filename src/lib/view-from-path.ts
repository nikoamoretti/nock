import { parseAppPath } from './paths'
import type { ViewId } from './types'

export function viewFromPath(pathname: string): ViewId {
  const parsed = parseAppPath(pathname)
  if (parsed) return parsed.view
  if (pathname.startsWith('/inbox')) return 'inbox'
  if (pathname.startsWith('/my-issues')) return 'my-issues'
  if (pathname.includes('/board')) return 'board'
  if (pathname.includes('/backlog')) return 'backlog'
  if (pathname.includes('/active')) return 'active'
  if (pathname.startsWith('/projects') || pathname.includes('/project/')) {
    return 'projects'
  }
  if (pathname.startsWith('/cycles') || pathname.includes('/cycle/')) {
    return 'cycles'
  }
  if (pathname.startsWith('/initiatives') || pathname.includes('/initiative/')) {
    return 'initiatives'
  }
  return 'all'
}
