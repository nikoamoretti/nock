import { normalizeIssue } from './issue-model'
import type {
  Cycle,
  Issue,
  Label,
  Project,
  Snapshot,
  Team,
  User,
  WorkflowState,
  Workspace,
} from './types'

export const IDS = {
  workspace: 'ws_acme',
  teamEng: 'team_eng',
  userMe: 'user_me',
  userMaya: 'user_maya',
  userJules: 'user_jules',
  stateTriage: 'state_triage',
  stateBacklog: 'state_backlog',
  stateTodo: 'state_todo',
  stateProgress: 'state_progress',
  stateReview: 'state_review',
  stateDone: 'state_done',
  stateCanceled: 'state_canceled',
  stateDuplicate: 'state_duplicate',
  labelBug: 'label_bug',
  labelFeature: 'label_feature',
  labelImprove: 'label_improve',
  projectSync: 'proj_sync',
  projectCommand: 'proj_command',
  cycleCurrent: 'cycle_current',
  milestoneLaunch: 'ms_launch',
} as const

function at(daysFromNow: number, now: number): number {
  return now + daysFromNow * 24 * 60 * 60 * 1000
}

export function createBootstrapSnapshot(options?: {
  demo?: boolean
  now?: number
}): Snapshot {
  const now = options?.now ?? Date.now()
  const workspace: Workspace = {
    id: IDS.workspace,
    name: 'Acme',
    urlKey: 'acme',
  }
  const teams: Team[] = [
    { id: IDS.teamEng, key: 'ENG', name: 'Engineering', issueCounter: 0 },
  ]
  const users: User[] = [
    {
      id: IDS.userMe,
      name: 'You',
      email: 'you@acme.test',
      initials: 'YO',
    },
    {
      id: IDS.userMaya,
      name: 'Maya Chen',
      email: 'maya@acme.test',
      initials: 'MC',
    },
    {
      id: IDS.userJules,
      name: 'Jules Ortiz',
      email: 'jules@acme.test',
      initials: 'JO',
    },
  ]
  const states: WorkflowState[] = [
    {
      id: IDS.stateTriage,
      teamId: IDS.teamEng,
      name: 'Triage',
      type: 'triage',
      color: '#eb5757',
      position: 0,
      isDefault: false,
    },
    {
      id: IDS.stateBacklog,
      teamId: IDS.teamEng,
      name: 'Backlog',
      type: 'backlog',
      color: '#bec2c8',
      position: 1,
      isDefault: false,
    },
    {
      id: IDS.stateTodo,
      teamId: IDS.teamEng,
      name: 'Todo',
      type: 'unstarted',
      color: '#e2e2e2',
      position: 2,
      isDefault: true,
    },
    {
      id: IDS.stateProgress,
      teamId: IDS.teamEng,
      name: 'In Progress',
      type: 'started',
      color: '#f2c94c',
      position: 3,
      isDefault: false,
    },
    {
      id: IDS.stateReview,
      teamId: IDS.teamEng,
      name: 'In Review',
      type: 'started',
      color: '#5e6ad2',
      position: 4,
      isDefault: false,
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
    {
      id: IDS.stateCanceled,
      teamId: IDS.teamEng,
      name: 'Canceled',
      type: 'canceled',
      color: '#95a2b3',
      position: 6,
      isDefault: false,
    },
    {
      id: IDS.stateDuplicate,
      teamId: IDS.teamEng,
      name: 'Duplicate',
      type: 'duplicate',
      color: '#95a2b3',
      position: 7,
      isDefault: false,
    },
  ]
  const labels: Label[] = [
    {
      id: IDS.labelBug,
      teamId: IDS.teamEng,
      name: 'Bug',
      color: '#eb5757',
    },
    {
      id: IDS.labelFeature,
      teamId: IDS.teamEng,
      name: 'Feature',
      color: '#bb87fc',
    },
    {
      id: IDS.labelImprove,
      teamId: IDS.teamEng,
      name: 'Improvement',
      color: '#4ea7fc',
    },
  ]
  const projects: Project[] = [
    {
      id: IDS.projectSync,
      teamId: IDS.teamEng,
      name: 'Local-first sync',
      description: 'In-memory object pool, IndexedDB, and a transaction log.',
      status: 'started',
      area: 'Infrastructure',
      health: 'on-track',
      createdAt: now - 12 * 86400000,
      updatedAt: now,
      syncId: 1,
    },
    {
      id: IDS.projectCommand,
      teamId: IDS.teamEng,
      name: 'Command palette',
      description: 'Keyboard-first actions and jump-to-issue search.',
      status: 'planned',
      area: 'Product',
      health: 'no-update',
      createdAt: now - 4 * 86400000,
      updatedAt: now,
      syncId: 2,
    },
  ]
  const cycles: Cycle[] = [
    {
      id: IDS.cycleCurrent,
      teamId: IDS.teamEng,
      number: 12,
      startsAt: at(-3, now),
      endsAt: at(11, now),
      createdAt: at(-3, now),
      updatedAt: now,
      syncId: 3,
    },
  ]

  const snapshot: Snapshot = {
    lastSyncId: 3,
    workspace,
    currentUserId: IDS.userMe,
    teams,
    users,
    states,
    labels,
    projects,
    cycles,
    milestones: [
      {
        id: IDS.milestoneLaunch,
        projectId: IDS.projectSync,
        name: 'Launch',
        sortOrder: 1,
      },
    ],
    issues: [],
    projectUpdates: [],
    pendingCommands: [],
    seenMutationIds: [],
  }

  if (options?.demo) {
    snapshot.issues = demoIssues(now)
    snapshot.teams[0].issueCounter = snapshot.issues.length
    snapshot.lastSyncId = 3 + snapshot.issues.length
  }

  return snapshot
}

function demoIssues(now: number): Issue[] {
  const rows: Array<
    Pick<Issue, 'title' | 'stateId' | 'priority' | 'assigneeId'> &
      Partial<Issue>
  > = [
    {
      title: 'Inbound: sync stalls on second laptop',
      description:
        'Reported from support. Client A writes an issue; client B stays on lastSyncId 0 until reload.',
      stateId: IDS.stateTriage,
      priority: 1,
      assigneeId: null,
      labelIds: [IDS.labelBug],
    },
    {
      title: 'Object pool should notify subscribers synchronously',
      description:
        'issue.title = "…" then issue.save() must paint before the network round-trip.',
      stateId: IDS.stateTodo,
      priority: 1,
      assigneeId: IDS.userMe,
      projectId: IDS.projectSync,
      cycleId: IDS.cycleCurrent,
      labelIds: [IDS.labelFeature],
    },
    {
      title: 'IndexedDB bootstrap before first paint',
      description:
        'Hydrate the object pool from IndexedDB, then catch up with deltas. IndexedDB is the UI database, not a cache.',
      stateId: IDS.stateProgress,
      priority: 2,
      assigneeId: IDS.userMe,
      projectId: IDS.projectSync,
      cycleId: IDS.cycleCurrent,
      labelIds: [IDS.labelFeature],
    },
    {
      title: 'Command menu fuzzy search',
      description: 'Cmd+K should find issues by identifier, title subsequence, and commands.',
      stateId: IDS.stateReview,
      priority: 3,
      assigneeId: IDS.userMaya,
      projectId: IDS.projectCommand,
      cycleId: IDS.cycleCurrent,
      labelIds: [IDS.labelFeature],
    },
    {
      title: 'Cycles: auto-rollover unfinished issues',
      description:
        'When a cycle ends, unfinished issues move to the next cycle. Not a CRDT — last writer wins.',
      stateId: IDS.stateBacklog,
      priority: 3,
      assigneeId: null,
      projectId: IDS.projectSync,
      labelIds: [IDS.labelImprove],
    },
    {
      title: 'Team identifiers ENG-N',
      description: 'Each team owns a monotonic issue number. Moving teams mints a new identifier.',
      stateId: IDS.stateDone,
      priority: 0,
      assigneeId: IDS.userJules,
      projectId: IDS.projectSync,
    },
    {
      title: 'Peek panel keyboard navigation',
      description: 'J/K in the list, Enter to peek, Esc to close. Do not steal keys while typing.',
      stateId: IDS.stateTodo,
      priority: 2,
      assigneeId: IDS.userMaya,
      cycleId: IDS.cycleCurrent,
      labelIds: [IDS.labelImprove],
    },
    {
      title: 'Board columns follow workflow state types',
      description:
        'Backlog → Todo → In Progress → In Review → Done. Dragging an issue writes a local transaction.',
      stateId: IDS.stateProgress,
      priority: 3,
      assigneeId: IDS.userJules,
      cycleId: IDS.cycleCurrent,
    },
    {
      title: 'Comments and activity log',
      description: 'Not in v1. GraphQL mutations later return lastSyncId only; comments arrive on the sync channel.',
      stateId: IDS.stateBacklog,
      priority: 4,
      assigneeId: null,
      projectId: IDS.projectCommand,
    },
    {
      title: 'Projects progress from child issues',
      description: 'Project % complete = completed issues / total issues in that project.',
      stateId: IDS.stateTodo,
      priority: 2,
      assigneeId: IDS.userMe,
      projectId: IDS.projectSync,
      cycleId: IDS.cycleCurrent,
    },
    {
      title: 'Native mobile clients',
      description: 'Linear ships Swift/Kotlin apps, not the web client. Out of scope for Nock v1.',
      stateId: IDS.stateCanceled,
      priority: 4,
      assigneeId: null,
    },
    {
      title: 'WebSocket delta channel',
      description:
        'Server later. Local Nock already assigns syncId so a future /sync/delta can replay the log.',
      stateId: IDS.stateTodo,
      priority: 3,
      assigneeId: IDS.userJules,
      projectId: IDS.projectSync,
    },
  ]

  return rows.map((row, index) => {
    const number = index + 1
    return normalizeIssue({
      id: `issue_${number}`,
      teamId: IDS.teamEng,
      number,
      identifier: `ENG-${number}`,
      title: row.title,
      description: row.description ?? '',
      priority: row.priority,
      stateId: row.stateId,
      assigneeId: row.assigneeId,
      projectId: row.projectId ?? null,
      cycleId: row.cycleId ?? null,
      labelIds: row.labelIds ?? [],
      parentId: null,
      sortOrder: number,
      createdAt: now - (rows.length - index) * 3600000,
      updatedAt: now - index * 60000,
      syncId: 3 + number,
      revision: 3 + number,
      lastMutationId: null,
      milestoneId: null,
      subscriberIds: [],
      relatedIssueIds: [],
      blockedByIds: [],
      duplicateOfId: null,
      archivedAt: null,
    })
  })
}
