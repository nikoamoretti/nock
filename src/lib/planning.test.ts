import { describe, expect, it } from 'vitest'
import {
  classifyCycles,
  cycleCapacity,
  cyclePhase,
  cycleProgress,
  cycleProgressGraph,
  dependencyInvalid,
  initiativeRollup,
  milestoneCompletion,
  moveRange,
  resizeRange,
  rolloverCycle,
  scopeChanges,
  snapToDay,
  timelineWindow,
  WEEK_MS,
  type TimelineZoom,
} from './planning'
import { IDS } from './seed'
import type { Cycle, Issue, Project, WorkflowState } from './types'

const NOW = Date.parse('2026-09-11T12:00:00.000Z')
const DAY = 86_400_000

function issue(over: Partial<Issue> & Pick<Issue, 'id' | 'title' | 'stateId'>): Issue {
  return {
    teamId: IDS.teamEng,
    number: 1,
    identifier: 'ENG-1',
    description: '',
    priority: 0,
    assigneeId: null,
    projectId: null,
    cycleId: null,
    labelIds: [],
    parentId: null,
    milestoneId: null,
    subscriberIds: [],
    relatedIssueIds: [],
    blockedByIds: [],
    duplicateOfId: null,
    archivedAt: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    syncId: 1,
    revision: 1,
    lastMutationId: null,
    ...over,
  }
}

function cycle(over: Partial<Cycle> & Pick<Cycle, 'id' | 'number'>): Cycle {
  return {
    teamId: IDS.teamEng,
    startsAt: NOW - 3 * DAY,
    endsAt: NOW + 11 * DAY,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    syncId: 1,
    scopeIssueIds: [],
    ...over,
  }
}

const STATES: WorkflowState[] = [
  {
    id: IDS.stateTodo,
    teamId: IDS.teamEng,
    name: 'Todo',
    type: 'unstarted',
    color: '#ccc',
    position: 1,
    isDefault: true,
  },
  {
    id: IDS.stateDone,
    teamId: IDS.teamEng,
    name: 'Done',
    type: 'completed',
    color: '#4cb782',
    position: 5,
    isDefault: false,
  },
]

describe('cycles', () => {
  it('classifies current, upcoming, and completed cycles', () => {
    const current = cycle({ id: 'c-now', number: 12 })
    const upcoming = cycle({
      id: 'c-next',
      number: 13,
      startsAt: NOW + 12 * DAY,
      endsAt: NOW + 26 * DAY,
    })
    const completed = cycle({
      id: 'c-prev',
      number: 11,
      startsAt: NOW - 20 * DAY,
      endsAt: NOW - 6 * DAY,
      completedAt: NOW - 6 * DAY,
    })
    expect(cyclePhase(current, NOW)).toBe('current')
    expect(cyclePhase(upcoming, NOW)).toBe('upcoming')
    expect(cyclePhase(completed, NOW)).toBe('completed')
    const groups = classifyCycles([upcoming, completed, current], NOW)
    expect(groups.current[0]?.id).toBe('c-now')
    expect(groups.upcoming[0]?.id).toBe('c-next')
    expect(groups.completed[0]?.id).toBe('c-prev')
  })

  it('estimates capacity from recent completed cycles', () => {
    const recent = [1, 2, 3].map((n) =>
      cycle({
        id: `c-${n}`,
        number: n,
        startsAt: NOW - (4 - n) * 14 * DAY,
        endsAt: NOW - (3 - n) * 14 * DAY,
        completedAt: NOW - (3 - n) * 14 * DAY,
      }),
    )
    const issues: Issue[] = [
      issue({ id: 'a', title: '1', stateId: IDS.stateDone, cycleId: 'c-1' }),
      issue({ id: 'b', title: '2', stateId: IDS.stateDone, cycleId: 'c-2' }),
      issue({ id: 'c', title: '3', stateId: IDS.stateDone, cycleId: 'c-2' }),
      issue({ id: 'd', title: '4', stateId: IDS.stateDone, cycleId: 'c-3' }),
      issue({ id: 'e', title: '5', stateId: IDS.stateDone, cycleId: 'c-3' }),
      issue({ id: 'f', title: '6', stateId: IDS.stateDone, cycleId: 'c-3' }),
    ]
    expect(cycleCapacity(recent, issues, STATES, 3, NOW)).toBe(2)
  })

  it('tracks scope added and removed after cycle start', () => {
    expect(scopeChanges(['a', 'b'], ['b', 'c'])).toEqual({
      added: ['c'],
      removed: ['a'],
    })
  })

  it('rolls incomplete issues into the next cycle', () => {
    const ended = cycle({
      id: 'c-11',
      number: 11,
      startsAt: NOW - 14 * DAY,
      endsAt: NOW - DAY,
    })
    const issues = [
      issue({ id: 'open', title: 'Still open', stateId: IDS.stateTodo, cycleId: 'c-11' }),
      issue({ id: 'done', title: 'Shipped', stateId: IDS.stateDone, cycleId: 'c-11' }),
    ]
    const result = rolloverCycle({
      cycle: ended,
      issues,
      states: STATES,
      now: NOW,
      durationWeeks: 2,
    })
    expect(result.completed.completedAt).toBe(NOW)
    expect(result.next.number).toBe(12)
    expect(result.next.startsAt).toBe(ended.endsAt)
    expect(result.next.endsAt - result.next.startsAt).toBe(2 * WEEK_MS)
    expect(result.moved.map((row) => row.id)).toEqual(['open'])
    expect(result.moved[0]?.cycleId).toBe(result.next.id)
    expect(issues.find((row) => row.id === 'done')?.cycleId).toBe('c-11')
  })

  it('builds a cumulative progress graph across the cycle', () => {
    const current = cycle({
      id: 'c-12',
      number: 12,
      startsAt: NOW - 2 * DAY,
      endsAt: NOW + 2 * DAY,
    })
    const issues = [
      issue({
        id: 'd1',
        title: 'Done day 0',
        stateId: IDS.stateDone,
        cycleId: 'c-12',
        updatedAt: NOW - 2 * DAY,
      }),
      issue({
        id: 'd2',
        title: 'Done day 1',
        stateId: IDS.stateDone,
        cycleId: 'c-12',
        updatedAt: NOW - DAY,
      }),
      issue({
        id: 'open',
        title: 'Open',
        stateId: IDS.stateTodo,
        cycleId: 'c-12',
      }),
    ]
    const graph = cycleProgressGraph(current, issues, STATES)
    expect(graph[0]?.completed).toBe(1)
    expect(graph[graph.length - 1]?.completed).toBe(2)
    expect(cycleProgress('c-12', issues, STATES).ratio).toBeCloseTo(2 / 3)
  })
})

describe('timeline dates and dependencies', () => {
  it('moves and resizes ranges, snapping to UTC days', () => {
    const start = Date.parse('2026-09-01T12:00:00.000Z')
    const end = Date.parse('2026-09-10T12:00:00.000Z')
    const moved = moveRange(start, end, 2 * DAY)
    expect(moved.startAt).toBe(snapToDay(start + 2 * DAY))
    expect(moved.targetAt - moved.startAt).toBe(end - start)
    const resized = resizeRange(start, end, 'end', DAY)
    expect(resized.targetAt).toBe(snapToDay(end + DAY))
    expect(resized.startAt).toBe(snapToDay(start))
  })

  it('opens a window for each zoom with a today column', () => {
    const zooms: TimelineZoom[] = ['week', 'month', 'quarter', 'year']
    for (const zoom of zooms) {
      const window = timelineWindow(NOW, zoom)
      expect(window.end).toBeGreaterThan(window.start)
      expect(window.todayOffset).toBeGreaterThanOrEqual(0)
      expect(window.todayOffset).toBeLessThan(1)
    }
  })

  it('marks a dependency invalid when the successor starts before the blocker ends', () => {
    expect(
      dependencyInvalid(
        { targetAt: NOW + 10 * DAY },
        { startAt: NOW + 4 * DAY },
      ),
    ).toBe(true)
    expect(
      dependencyInvalid(
        { targetAt: NOW + 4 * DAY },
        { startAt: NOW + 10 * DAY },
      ),
    ).toBe(false)
  })
})

describe('milestones, cross-team projects, initiative rollups', () => {
  it('computes milestone completion from associated issues', () => {
    const issues = [
      issue({
        id: 'a',
        title: 'A',
        stateId: IDS.stateDone,
        milestoneId: 'ms_1',
      }),
      issue({
        id: 'b',
        title: 'B',
        stateId: IDS.stateTodo,
        milestoneId: 'ms_1',
      }),
    ]
    expect(milestoneCompletion('ms_1', issues, STATES)).toBeCloseTo(0.5)
  })

  it('lets a project span multiple teams', () => {
    const project: Project = {
      id: 'proj_shared',
      teamId: IDS.teamEng,
      teamIds: [IDS.teamEng, 'team_design'],
      memberIds: [IDS.userMe, IDS.userMaya],
      name: 'Shared',
      description: '',
      summary: '',
      status: 'started',
      area: 'Platform',
      health: 'on-track',
      leadId: IDS.userMe,
      startAt: NOW,
      targetAt: NOW + 30 * DAY,
      blockedByIds: [],
      createdAt: NOW,
      updatedAt: NOW,
      syncId: 1,
    }
    const issues = [
      issue({ id: 'eng', title: 'Eng', stateId: IDS.stateTodo, projectId: project.id }),
      issue({
        id: 'des',
        title: 'Design',
        stateId: IDS.stateTodo,
        teamId: 'team_design',
        projectId: project.id,
      }),
    ]
    expect(project.teamIds).toContain('team_design')
    expect(issues.filter((row) => row.projectId === project.id)).toHaveLength(2)
  })

  it('rolls initiative progress and health up from member projects', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        teamId: IDS.teamEng,
        teamIds: [IDS.teamEng],
        memberIds: [],
        name: 'One',
        description: '',
        summary: '',
        status: 'started',
        area: '',
        health: 'on-track',
        leadId: null,
        startAt: NOW,
        targetAt: NOW + 10 * DAY,
        blockedByIds: [],
        createdAt: NOW,
        updatedAt: NOW,
        syncId: 1,
      },
      {
        id: 'p2',
        teamId: IDS.teamEng,
        teamIds: [IDS.teamEng],
        memberIds: [],
        name: 'Two',
        description: '',
        summary: '',
        status: 'started',
        area: '',
        health: 'off-track',
        leadId: null,
        startAt: NOW,
        targetAt: NOW + 20 * DAY,
        blockedByIds: ['p1'],
        createdAt: NOW,
        updatedAt: NOW,
        syncId: 2,
      },
    ]
    const issues = [
      issue({ id: 'a', title: 'A', stateId: IDS.stateDone, projectId: 'p1' }),
      issue({ id: 'b', title: 'B', stateId: IDS.stateTodo, projectId: 'p1' }),
      issue({ id: 'c', title: 'C', stateId: IDS.stateTodo, projectId: 'p2' }),
    ]
    const rollup = initiativeRollup(['p1', 'p2'], projects, issues, STATES)
    expect(rollup.health).toBe('off-track')
    expect(rollup.progress.completed).toBe(1)
    expect(rollup.progress.total).toBe(3)
    expect(dependencyInvalid(projects[0]!, projects[1]!)).toBe(true)
  })
})
