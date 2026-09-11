import { createBootstrapSnapshot, IDS } from './seed'
import type {
  Issue,
  Label,
  Priority,
  Project,
  ProjectHealth,
  ProjectStatus,
  ProjectUpdate,
  Snapshot,
} from './types'

type Phase =
  | 'New'
  | 'Planning'
  | 'Building'
  | 'Active'
  | 'Research'
  | 'Recovery'
  | 'Archived'

type SeedProject = {
  id: string
  name: string
  area: string
  phase: Phase
  heat: 'hot' | 'warm' | 'cold'
  description: string
  tech: string
  status: string
  progress?: string
  note?: string
  blockers: string[]
  updated: string
}

type SeedIssue = {
  projectId: string
  title: string
  priority: 'U' | 'H' | 'M' | 'L'
  points: 'S' | 'M' | 'L' | 'XL'
  labels: string[]
  doneWhen: string
  state?: 'todo' | 'progress' | 'backlog' | 'done'
  cycle?: boolean
}

const PRIORITY: Record<SeedIssue['priority'], Priority> = {
  U: 1,
  H: 2,
  M: 3,
  L: 4,
}

const LABEL_COLORS = [
  '#eb5757',
  '#f2c94c',
  '#6b75f0',
  '#4cb782',
  '#26b5ce',
  '#bb87fc',
  '#f2994a',
  '#4ea7fc',
  '#95a2b3',
]

const PROJECTS: SeedProject[] = [
  {
    id: 'endpoint-ledger',
    name: 'Endpoint Ledger',
    area: 'AI / data product',
    phase: 'Building',
    heat: 'hot',
    description:
      'LLM endpoint observation platform. Python/SQLAlchemy 2/Alembic/Postgres/Docker. No Celery/Redis/SPA.',
    tech: 'Python, SQLAlchemy 2, Alembic, Postgres, Docker',
    status:
      'Active worktree — baseline operations + evidence durability. Phase 1.1 (measurement integrity) and 1.2 (evidence durability) spec\'d in AGENTS.md. 5 commits around Baseline Operations.',
    progress:
      '5 commits around Baseline Operations; Phase 1.1/1.2 invariants spec-complete; baseline cohort is collecting (run 6), not yet qualified.',
    note: 'Current working dir. Uncommitted nested repos: phonescope, facecheck-link-extractor, facefind.',
    blockers: [],
    updated: '2026-09-10',
  },
  {
    id: 'phonescope',
    name: 'PhoneScope',
    area: 'OSINT workbench',
    phase: 'Building',
    heat: 'warm',
    description: 'US-only OSINT lookup workbench.',
    tech: 'FastAPI, SearXNG, Ollama',
    status:
      'Private US-only OSINT lookup workbench. Most providers unconfigured/unavailable — useless until configured.',
    progress: 'Workbench scaffolded; value is zero until real providers are wired.',
    blockers: ['Providers unconfigured/unavailable'],
    updated: '2026-09-10',
  },
  {
    id: 'forecastlab',
    name: 'ForecastLab',
    area: 'AI / data product',
    phase: 'Planning',
    heat: 'hot',
    description: 'Forecast/backtest evaluation product.',
    tech: '',
    status:
      'Mid-activation: qualification runs OK; OAuth + Neon + real resolved-question corpus still unblock it. Paid-smoke fail-closed, cost ceiling intact.',
    progress:
      'Qualification runs pass; live path still blocked on OAuth + Neon + resolved-question corpus.',
    blockers: ['OAuth', 'Neon', 'real resolved-question corpus'],
    updated: '2026-09-09',
  },
  {
    id: 'ventureatlas',
    name: 'VentureAtlas',
    area: 'AI / data product',
    phase: 'Building',
    heat: 'hot',
    description: 'Opportunity discovery platform.',
    tech: 'Vercel, Neon',
    status:
      'Private-cloud cutover done (Vercel/Neon), cron auth verified, release-candidate fix on Sep 4, opportunity desk live.',
    progress: 'Needs QA before ship.',
    blockers: [],
    updated: '2026-09-04',
  },
  {
    id: 'scenelle',
    name: 'Scenelle',
    area: 'AI / data product',
    phase: 'New',
    heat: 'hot',
    description: 'AI Creator Studio.',
    tech: '',
    status: 'Brand new (Sep 9). Undocumented scope.',
    progress: 'No scope defined.',
    blockers: ['Undocumented scope'],
    updated: '2026-09-09',
  },
  {
    id: 'folium-next',
    name: 'Folium Next',
    area: 'iOS app',
    phase: 'Building',
    heat: 'warm',
    description: 'Obsidian-style local-first note app.',
    tech: 'iOS, TestFlight',
    status:
      'Obsidian-parity feature branch + sync; 267-note vault is a one-time copy, not live sync.',
    blockers: ['Needs device-level validation'],
    updated: '',
  },
  {
    id: 'interview-os',
    name: 'Interview OS + Career Search',
    area: 'Career system',
    phase: 'Active',
    heat: 'hot',
    description:
      'Interview prep PWA + career search. Defaults: $150k, US auth yes, sponsorship no, relocate yes.',
    tech: 'PWA, iPhone',
    status:
      '191 tests. Canonical resume DB + role-specific PDFs. Apps in flight: Outset, Corner Health, Flexport, Axial.',
    blockers: [],
    updated: '',
  },
  {
    id: 'france-move',
    name: 'France Move Command Center',
    area: 'Life logistics',
    phase: 'Active',
    heat: 'hot',
    description: 'Personal relocation to France (Bandol).',
    tech: '',
    status:
      '156-item inventory (93 sell, $2.8k realistic), FM task ledger, budget sheet. Luna (29 lb dog) pet travel is the critical blocker (large-dog no-cargo flights).',
    progress: 'Inventory, ledger, and budget sheet done; relocation still blocked on pet travel.',
    blockers: [
      'Luna pet travel (large-dog no-cargo flights)',
      'Kia Stinger sale unresolved',
      'VPN research',
    ],
    updated: '',
  },
  {
    id: 'lens-app-factory',
    name: 'Lens App Factory',
    area: 'iOS app',
    phase: 'Building',
    heat: 'hot',
    description: '8 iOS lens apps (scanners + AI generation).',
    tech: 'iOS, LensKit, Vercel',
    status:
      'ToyLens, CoinLens, VinylLens, StampLens, ComicLens, WoodLens + RoomLens, HairLens. Shared LensKit + API proxy live on Vercel. CoinLens is the frontrunner (273 review sessions).',
    blockers: [
      'CoinLens first-time subscriptions must attach via Apple web review flow (needs Apple login)',
    ],
    updated: '',
  },
  {
    id: 'faceblur-local',
    name: 'FaceBlur Local',
    area: 'AI / data product',
    phase: 'Building',
    heat: 'warm',
    description: 'Native local face redaction.',
    tech: '',
    status:
      'Native face-redaction for the Nathan/Christine video archive. Dogfooding daily; segments export, then AI-cleanup/private-cloud model limits block.',
    progress: 'Timed splitting + refresh shipped (0.8.14); export works; paid processing still blocked.',
    blockers: ['AI-cleanup / private-cloud model limits', 'Google OAuth access'],
    updated: '',
  },
  {
    id: 'native-app-trio',
    name: 'Pensées / Verbum / Vigil / Unspool',
    area: 'iOS app',
    phase: 'Building',
    heat: 'hot',
    description: 'Native app trio (Pensées / Verbum / Vigil) + voice-notes Unspool.',
    tech: 'iOS, TestFlight, StoreKit',
    status:
      'TestFlight builds 24/34/35. Vigil 1.4 public; screenshot A/B live. StoreKit + on-device acceptance still gates.',
    blockers: ['StoreKit + on-device acceptance'],
    updated: '',
  },
  {
    id: 'kalshi-research',
    name: 'Kalshi research',
    area: 'Research / trading',
    phase: 'Research',
    heat: 'warm',
    description: 'Prediction-market strategy research.',
    tech: '',
    status:
      'Strategy Proof Engine (273 sessions), Weather Desk paper-money, structural-arb. Accounting/trading boundaries partitioned.',
    blockers: [],
    updated: '',
  },
  {
    id: 'railhub-etc',
    name: 'Railhub v2 / Railfriend · Traktive/Telegraph/YardLogix · Axial Verify · CompanyLens',
    area: 'Digital products',
    phase: 'Recovery',
    heat: 'warm',
    description: 'Cluster of digital products (Good Things Club line) in operational/recovery states.',
    tech: '',
    status:
      'Railfriend needs narrow Vercel rate-limiting (not Cloudflare); CompanyLens recovered but live DB unavailable, xAI blocked.',
    blockers: [
      'Railfriend Vercel rate-limiting',
      'CompanyLens live DB unavailable',
      'xAI blocked',
    ],
    updated: '',
  },
  {
    id: 'long-tail',
    name: 'Long-tail repos',
    area: 'Experiments',
    phase: 'Archived',
    heat: 'cold',
    description: 'Long tail of experimental and archived repos.',
    tech: '',
    status:
      'Scrapers, experiments, portfolio, llm-seo-audit, gstack, jdownloader, civic-ledger, etc. Mostly archived/experimental.',
    blockers: [],
    updated: '',
  },
  {
    id: 'heartbeat',
    name: 'Automated heartbeat',
    area: 'Ops',
    phase: 'Active',
    heat: 'warm',
    description:
      'Informational. These machines account for ~1,200 of 1,310 sessions and are not roadmapped as product work.',
    tech: '',
    status: 'Running. Not a delivery project.',
    blockers: [],
    updated: '2026-09-10',
  },
]

const ISSUES: SeedIssue[] = [
  {
    projectId: 'endpoint-ledger',
    title: 'Verify test_failed_check_adjudication.py',
    priority: 'U',
    points: 'S',
    labels: ['endpoint-ledger', 'phase-1.2'],
    doneWhen: 'Test passes locally and in the suite',
    cycle: true,
  },
  {
    projectId: 'endpoint-ledger',
    title: 'Detangle + commit nested repos (phonescope, facefind, facecheck-link-extractor)',
    priority: 'H',
    points: 'M',
    labels: ['endpoint-ledger', 'cleanup'],
    doneWhen: 'Nested dirs untangled or committed; incident doc committed',
    cycle: true,
  },
  {
    projectId: 'endpoint-ledger',
    title: 'Close Phase 1.2 in-flight adjudication work',
    priority: 'H',
    points: 'L',
    labels: ['endpoint-ledger', 'phase-1.2'],
    doneWhen: 'Adjudication records added without rewriting sealed Scores',
    state: 'progress',
    cycle: true,
  },
  {
    projectId: 'endpoint-ledger',
    title: 'Re-qualify baseline cohort',
    priority: 'M',
    points: 'L',
    labels: ['endpoint-ledger', 'baseline'],
    doneWhen: 'Cohort meets calendar coverage, 2+ runs, distinct UTC dates, no measurement defect',
    state: 'backlog',
  },
  {
    projectId: 'phonescope',
    title: 'Wire at least one real OSINT provider',
    priority: 'M',
    points: 'L',
    labels: ['phonescope', 'osint', 'blocker'],
    doneWhen: 'Sample lookup returns exact-number + source-URL match',
  },
  {
    projectId: 'forecastlab',
    title: 'Unblock OAuth route',
    priority: 'H',
    points: 'M',
    labels: ['forecastlab', 'blocker'],
    doneWhen: 'OAuth completes unattended',
    cycle: true,
  },
  {
    projectId: 'forecastlab',
    title: 'Provision Neon + restore live DB',
    priority: 'H',
    points: 'M',
    labels: ['forecastlab', 'blocker'],
    doneWhen: 'Live DB reachable, migrations applied',
    cycle: true,
  },
  {
    projectId: 'forecastlab',
    title: 'Resume planning (do not cut research depth)',
    priority: 'H',
    points: 'S',
    labels: ['forecastlab'],
    doneWhen: 'Next planning note produced',
  },
  {
    projectId: 'forecastlab',
    title: 'Run one paid smoke suite (fail-closed)',
    priority: 'H',
    points: 'M',
    labels: ['forecastlab'],
    doneWhen: 'Smoke passed or failed closed, cost within ceiling',
  },
  {
    projectId: 'forecastlab',
    title: 'Assemble resolved-question corpus',
    priority: 'M',
    points: 'L',
    labels: ['forecastlab', 'data'],
    doneWhen: 'Corpus of real resolved questions available for backtest',
    state: 'backlog',
  },
  {
    projectId: 'ventureatlas',
    title: 'Release-candidate QA',
    priority: 'U',
    points: 'L',
    labels: ['ventureatlas', 'qa'],
    doneWhen: 'RC passes QA checklist',
    cycle: true,
  },
  {
    projectId: 'ventureatlas',
    title: 'Ship + verify prod cron auth',
    priority: 'U',
    points: 'M',
    labels: ['ventureatlas', 'ship'],
    doneWhen: 'Deployed and cron auth verified in prod',
    cycle: true,
  },
  {
    projectId: 'scenelle',
    title: 'Define what Scenelle is (scope)',
    priority: 'H',
    points: 'M',
    labels: ['scenelle', 'blocker'],
    doneWhen: 'One-page scope reconstructed from latest session',
    cycle: true,
  },
  {
    projectId: 'scenelle',
    title: 'Land name + positioning',
    priority: 'H',
    points: 'S',
    labels: ['scenelle'],
    doneWhen: 'Name/positioning decision recorded',
  },
  {
    projectId: 'faceblur-local',
    title: 'Resolve Google OAuth access',
    priority: 'H',
    points: 'M',
    labels: ['faceblur', 'blocker'],
    doneWhen: 'Sign-in succeeds; paid processing unblocked',
  },
  {
    projectId: 'faceblur-local',
    title: 'Resolve private-cloud model limits',
    priority: 'M',
    points: 'M',
    labels: ['faceblur'],
    doneWhen: 'AI-cleanup completes without hitting limits',
  },
  {
    projectId: 'folium-next',
    title: 'Device-level validation',
    priority: 'M',
    points: 'M',
    labels: ['folium-next'],
    doneWhen: 'Sync + parity verified on a physical device',
  },
  {
    projectId: 'lens-app-factory',
    title: 'Attach CoinLens first-time subscriptions via Apple web review',
    priority: 'H',
    points: 'M',
    labels: ['coinlens', 'blocker'],
    doneWhen: 'Subscriptions live through Apple web flow (needs Apple login)',
    cycle: true,
  },
  {
    projectId: 'lens-app-factory',
    title: 'Decide: revive ToyLens or close the goal',
    priority: 'M',
    points: 'S',
    labels: ['toylens', 'blocker'],
    doneWhen: 'ToyLens is a live project or the goal is closed',
  },
  {
    projectId: 'native-app-trio',
    title: 'StoreKit configuration',
    priority: 'M',
    points: 'M',
    labels: ['native-trio'],
    doneWhen: 'StoreKit wiring complete for shipping apps',
  },
  {
    projectId: 'native-app-trio',
    title: 'Physical iPhone acceptance',
    priority: 'M',
    points: 'M',
    labels: ['native-trio'],
    doneWhen: 'On-device acceptance passed per app',
  },
  {
    projectId: 'interview-os',
    title: 'Keep final-submit as a human checkpoint',
    priority: 'M',
    points: 'S',
    labels: ['career'],
    doneWhen: 'No app auto-submits; human reviews before every send',
  },
  {
    projectId: 'france-move',
    title: 'Resolve Luna large-dog flight (no-cargo)',
    priority: 'U',
    points: 'L',
    labels: ['france-move', 'blocker'],
    doneWhen: 'A large-dog, no-cargo flight is booked/confirmed',
    cycle: true,
  },
  {
    projectId: 'france-move',
    title: 'Sell the Kia Stinger',
    priority: 'H',
    points: 'M',
    labels: ['france-move', 'blocker'],
    doneWhen: 'Car sold or a concrete sale path locked',
  },
  {
    projectId: 'france-move',
    title: 'Finish VPN research',
    priority: 'L',
    points: 'S',
    labels: ['france-move'],
    doneWhen: 'VPN recommendation decided',
    state: 'backlog',
  },
  {
    projectId: 'kalshi-research',
    title: 'Keep paper-only gate on new strategies',
    priority: 'M',
    points: 'S',
    labels: ['kalshi'],
    doneWhen: 'No live capital without passing the gate',
  },
  {
    projectId: 'kalshi-research',
    title: 'File broker-level diligence',
    priority: 'M',
    points: 'L',
    labels: ['kalshi', 'blocker'],
    doneWhen: 'Diligence issue scoped or the goal is closed',
    state: 'backlog',
  },
  {
    projectId: 'railhub-etc',
    title: 'Narrow Railfriend Vercel rate-limiting',
    priority: 'M',
    points: 'M',
    labels: ['railfriend', 'blocker'],
    doneWhen: 'Rate limiting scoped in Vercel (not Cloudflare)',
  },
  {
    projectId: 'railhub-etc',
    title: 'Restore CompanyLens live DB + unblock xAI',
    priority: 'M',
    points: 'L',
    labels: ['companylens', 'blocker'],
    doneWhen: 'Live DB reachable, xAI dependency resolved',
  },
  {
    projectId: 'long-tail',
    title: 'Triage: archive vs portfolio backfill',
    priority: 'L',
    points: 'M',
    labels: ['long-tail'],
    doneWhen: 'Each dormant repo marked archive or portfolio-fodder',
    state: 'backlog',
  },
  {
    projectId: 'long-tail',
    title: 'Recover the pasted-file goal reference and re-scope',
    priority: 'L',
    points: 'S',
    labels: ['long-tail', 'blocker'],
    doneWhen: 'File reference recovered or the goal is closed',
    state: 'backlog',
  },
]

const HEARTBEAT_UPDATES = [
  {
    title: 'Chief of Staff / Chief Watchdog',
    detail: 'Twice-daily control tower.',
  },
  {
    title: 'iOS Factory autopilots',
    detail: 'Release monitor, PM board, growth metrics.',
  },
  {
    title: 'Luna/Terra/Sol model router',
    detail: 'Currently per-turn overrides; no auto-max.',
  },
  {
    title: 'Volume note',
    detail: 'These account for ~1,200 of 1,310 sessions.',
  },
]

export function projectSeedId(id: string): string {
  return `proj_${id}`
}

function phaseStatus(phase: Phase): ProjectStatus {
  if (phase === 'New' || phase === 'Planning') return 'planned'
  if (phase === 'Archived') return 'canceled'
  return 'started'
}

function projectHealth(project: SeedProject): ProjectHealth {
  if (project.phase === 'Archived') return 'no-update'
  if (project.blockers.length > 0 && project.heat === 'hot') return 'off-track'
  if (project.blockers.length > 0) return 'at-risk'
  if (project.heat === 'cold') return 'no-update'
  return 'on-track'
}

function parseDay(iso: string, fallback: number): number {
  if (!iso) return fallback
  const stamp = Date.parse(`${iso}T12:00:00.000Z`)
  return Number.isNaN(stamp) ? fallback : stamp
}

function stateId(kind: SeedIssue['state']): string {
  if (kind === 'progress') return IDS.stateProgress
  if (kind === 'backlog') return IDS.stateBacklog
  if (kind === 'done') return IDS.stateDone
  return IDS.stateTodo
}

export function createWorkspaceSnapshot(now = Date.now()): Snapshot {
  const snapshot = createBootstrapSnapshot({ demo: false, now })
  snapshot.workspace = {
    id: 'ws_nico',
    name: 'Nico',
    urlKey: 'nico',
  }

  const labelNames = [
    ...new Set(ISSUES.flatMap((issue) => issue.labels)),
  ].sort()
  const labels: Label[] = labelNames.map((name, index) => ({
    id: `label_${name}`,
    teamId: IDS.teamEng,
    name,
    color: name === 'blocker' ? '#eb5757' : LABEL_COLORS[index % LABEL_COLORS.length],
  }))
  snapshot.labels = labels

  const projects: Project[] = PROJECTS.map((project, index) => {
    const updatedAt = parseDay(project.updated, now - index * 86400000)
    return {
      id: projectSeedId(project.id),
      teamId: IDS.teamEng,
      name: project.name,
      description: [project.description, project.tech && `Stack: ${project.tech}`]
        .filter(Boolean)
        .join('\n'),
      status: phaseStatus(project.phase),
      area: project.area,
      health: projectHealth(project),
      createdAt: updatedAt - 14 * 86400000,
      updatedAt,
      syncId: 10 + index,
    }
  })
  snapshot.projects = projects

  const updates: ProjectUpdate[] = []
  let syncId = 40
  for (const project of PROJECTS) {
    const createdAt = parseDay(project.updated, now)
    const parts = [project.progress, project.status, project.note].filter(Boolean)
    updates.push({
      id: `upd_${project.id}_status`,
      projectId: projectSeedId(project.id),
      authorId: IDS.userMe,
      health: projectHealth(project),
      body: parts.join('\n\n'),
      createdAt,
      syncId: syncId++,
    })
    if (project.id === 'heartbeat') {
      HEARTBEAT_UPDATES.forEach((item, index) => {
        updates.push({
          id: `upd_heartbeat_${index}`,
          projectId: projectSeedId('heartbeat'),
          authorId: IDS.userMe,
          health: 'on-track',
          body: `${item.title}\n${item.detail}`,
          createdAt: now - (HEARTBEAT_UPDATES.length - index) * 3600000,
          syncId: syncId++,
        })
      })
    }
  }

  const issues: Issue[] = ISSUES.map((row, index) => {
    const number = index + 1
    const createdAt = now - (ISSUES.length - index) * 3600000
    return {
      id: `issue_map_${number}`,
      teamId: IDS.teamEng,
      number,
      identifier: `ENG-${number}`,
      title: row.title,
      description: `Estimate ${row.points}. Done when: ${row.doneWhen}.`,
      priority: PRIORITY[row.priority],
      stateId: stateId(row.state),
      assigneeId: IDS.userMe,
      projectId: projectSeedId(row.projectId),
      cycleId: row.cycle ? IDS.cycleCurrent : null,
      labelIds: row.labels.map((name) => `label_${name}`),
      parentId: null,
      sortOrder: number,
      createdAt,
      updatedAt: createdAt,
      syncId: syncId++,
      milestoneId: null,
      subscriberIds: [IDS.userMe],
      relatedIssueIds: [],
      blockedByIds: [],
      duplicateOfId: null,
      archivedAt: null,
    }
  })

  snapshot.issues = issues
  snapshot.projectUpdates = updates
  snapshot.milestones = snapshot.projects[0]
    ? [
        {
          id: 'ms_launch',
          projectId: snapshot.projects[0].id,
          name: 'Launch',
          sortOrder: 1,
        },
      ]
    : []
  snapshot.teams[0] = {
    ...snapshot.teams[0],
    name: 'Workspace',
    issueCounter: issues.length,
  }
  snapshot.lastSyncId = syncId
  return snapshot
}
