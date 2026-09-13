import { describe, expect, it } from 'vitest'
import {
  canonicalizeLocation,
  canonicalizePath,
  collectionPath,
  cyclePath,
  cyclesCurrentPath,
  identifierFromPath,
  issueFullPath,
  issuePeekPath,
  locationNeedsCanonical,
  migrateLegacyPath,
  parseAppPath,
} from './paths'

const scope = { workspaceKey: 'acme', teamKey: 'ENG' }

describe('issue paths', () => {
  it('builds workspace-scoped collection, peek, and full routes', () => {
    expect(collectionPath('all', scope)).toBe('/acme/team/ENG/all')
    expect(issuePeekPath('all', 'ENG-12', scope)).toBe(
      '/acme/team/ENG/all/ENG-12',
    )
    expect(issueFullPath('ENG-12', scope)).toBe('/acme/issue/ENG-12')
    expect(identifierFromPath('/acme/team/ENG/all/ENG-12')).toBe('ENG-12')
    expect(identifierFromPath('/acme/issue/ENG-12')).toBe('ENG-12')
    expect(collectionPath('initiatives', scope)).toBe('/acme/initiatives')
    expect(cyclePath('cycle_1', scope)).toBe('/acme/team/ENG/cycle/cycle_1')
    expect(cyclesCurrentPath(scope)).toBe('/acme/team/ENG/cycles/current')
  })

  it('parses team and planning routes', () => {
    expect(parseAppPath('/acme/inbox/ENG-1')).toMatchObject({
      workspaceKey: 'acme',
      view: 'inbox',
      identifier: 'ENG-1',
    })
    expect(parseAppPath('/acme/team/ENG/board')).toMatchObject({
      view: 'board',
      teamKey: 'ENG',
    })
    expect(parseAppPath('/acme/project/proj_1')).toMatchObject({
      view: 'projects',
      projectId: 'proj_1',
    })
  })

  it('migrates hash and legacy paths onto the workspace', () => {
    expect(migrateLegacyPath('/eng/all', scope)).toBe('/acme/team/ENG/all')
    expect(migrateLegacyPath('/inbox', scope)).toBe('/acme/inbox')
    expect(migrateLegacyPath('/issues/ENG-9', scope)).toBe('/acme/issue/ENG-9')
    expect(migrateLegacyPath('/cycles/current', scope)).toBe(
      '/acme/team/ENG/cycles/current',
    )
    expect(canonicalizePath('/', '#/eng/all', scope)).toBe(
      '/acme/team/ENG/all',
    )
    expect(locationNeedsCanonical('/acme/team/ENG/all', '', '', scope)).toBeNull()
    expect(locationNeedsCanonical('/', '', '#/inbox', scope)).toEqual({
      pathname: '/acme/inbox',
      search: '',
    })
    expect(canonicalizePath('/nico/inbox', '', scope)).toBe('/nico/inbox')
    expect(parseAppPath('/acme/document/doc_sync')).toMatchObject({
      view: 'projects',
      documentId: 'doc_sync',
    })
    expect(
      canonicalizeLocation('/', '?layout=list', '#/eng/all?priority=1', scope),
    ).toEqual({
      pathname: '/acme/team/ENG/all',
      search: '?priority=1&layout=list',
    })
  })
})
