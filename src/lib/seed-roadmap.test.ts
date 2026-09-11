import { describe, expect, it } from 'vitest'
import { createWorkspaceSnapshot, projectSeedId } from './seed-roadmap'

describe('workspace snapshot from the Sep 10 project map', () => {
  it('loads every project with an update and linked issues', () => {
    const snapshot = createWorkspaceSnapshot(Date.parse('2026-09-10T12:00:00Z'))
    expect(snapshot.workspace.name).toBe('Nico')
    expect(snapshot.projects.map((project) => project.name)).toContain(
      'Endpoint Ledger',
    )
    expect(snapshot.projects).toHaveLength(15)
    expect(snapshot.issues.length).toBeGreaterThan(20)
    const ledger = snapshot.projects.find(
      (project) => project.id === projectSeedId('endpoint-ledger'),
    )
    expect(ledger).toBeTruthy()
    const ledgerIssues = snapshot.issues.filter(
      (issue) => issue.projectId === ledger?.id,
    )
    expect(ledgerIssues.map((issue) => issue.title)).toContain(
      'Verify test_failed_check_adjudication.py',
    )
    expect(
      snapshot.projectUpdates.some(
        (update) => update.projectId === ledger?.id && update.body.length > 0,
      ),
    ).toBe(true)
    expect(
      snapshot.issues.filter((issue) =>
        issue.labelIds.includes('label_blocker'),
      ).length,
    ).toBeGreaterThan(0)
  })
})
