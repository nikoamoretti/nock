import type { ViewId } from './types'

export function viewFromPath(pathname: string): ViewId {
  if (pathname.startsWith('/inbox')) return 'inbox'
  if (pathname.startsWith('/my-issues')) return 'my-issues'
  if (pathname.includes('/board')) return 'board'
  if (pathname.includes('/backlog')) return 'backlog'
  if (pathname.includes('/active')) return 'active'
  if (pathname.startsWith('/projects')) return 'projects'
  if (pathname.startsWith('/cycles')) return 'cycles'
  if (pathname.startsWith('/initiatives')) return 'initiatives'
  return 'all'
}
