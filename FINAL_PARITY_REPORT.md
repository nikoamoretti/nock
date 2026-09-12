# Nock Linear-quality parity report

Date: 2026-09-11  
Repo: https://github.com/nikoamoretti/nock  
App: Vite + React + TypeScript SPA (HashRouter), IndexedDB `nock`, GraphQL/PGlite on `:8787`, Mac app `Nock.app`.

## Test bar (this audit)

| Check | Result |
| --- | --- |
| `npx tsc -b` | pass |
| `npx oxlint src server` | pass (pre-existing React purity/ref warnings) |
| `npm test` | **126** unit tests pass |
| Playwright `npm run test:e2e` | **14** tests pass |
| DB migrations | `001_init`, `002_planning`, `003_integrations` applied in `server/schema.test.ts` |
| API / GraphQL | `server/graphql.test.ts` + live sync tests |
| Accessibility regressions | `src/lib/a11y.test.tsx` |
| Visual / density | list **34px**, board column **300px** (Playwright) |
| Performance | see measurements below |

Critical audit fixes in this pass: modal `role="dialog"` on composer / command palette / help; persist banner `role="status"`; issue list `listbox` + roving `tabIndex`; inbox `tablist`; labelled `main` / sidebar `nav`. Regression tests cover each.

## Parity areas

1. **Local-first issue state** — Issues live in one ID map. Views look up by ID. Optimistic patches, `clientMutationId`, pending queue, statuses queued → sending → acknowledged / failed / conflict. IndexedDB snapshot + entities + commands. Inverse patches. Dedupe by mutation id + revision. Online success has **no spinner**.
2. **Core issue experience** — 34px virtualized list, 300px board with drag and `[` `]`, filter AST, groupBy / subgroupBy / orderBy, saved views, peek + full page, shared `SearchablePicker`, create / status / multi-select / Back-restore / offline mutation.
3. **GraphQL API + PostgreSQL** — Tenant tables including planning and integration objects. Yoga on `:8787`. `GraphQLSyncBackend` talks to it when `VITE_GRAPHQL_URL` (or `/graphql` in DEV) is set. IndexedDB stays the visible cache.
4. **Realtime sync** — `workspace_changes` sequence, websocket `/sync`, checkpoint after durable apply, gap → delta fetch, private-team authorization, 10k catch-up tests.
5. **Cycles, projects, timeline, initiatives** — One timeline engine in `src/components/timeline-engine.tsx`. Cycles with capacity / rollover / current shortcut. Projects, milestones, initiative rollups. `src/components/plan-views.tsx` is the only roadmap surface.
6. **Triage + Inbox** — Queue keys **1 / 2 / 3 / H**, stay in queue, undoable snooze, duplicate picker + support-link merge, ordered rules. Notifications: Priority / Other, mark read / archive, delivery preference checkboxes, 100-item and 2,000-notification tests.
7. **Integrations + webhooks** — Provider-neutral `IntegrationInstallation`, `ExternalLink`, `ExternalIdentity`, inbound receipts, outbound HMAC-SHA256. GitHub PR/commit linking and status automation **without GitHub columns on Issue**. GitLab / Slack / Sentry / Zendesk / Front are stubs.

## Better than target

- IndexedDB remains usable while reconnecting; the banner says so instead of clearing the UI.
- Mac app can run without Docker via PGlite, with the same SQL migrations as a future hosted Postgres.
- One command catalog (`src/lib/command-system`) instead of a parallel action layer.
- Immediate local ack on the demo path: typing and status changes never wait on a network spinner.
- Issue keys and PRs are represented as `ExternalLink` metadata, so the issue schema stays provider-neutral.

## Remaining mismatches

- **Auth / tenancy:** local `x-nock-user-id` headers, not OAuth / workspace switcher / guests.
- **Hosted GraphQL:** the Mac app still boots from IndexedDB seed; the API is a local/dev process (`npm run api`).
- **Notifications and installations** are client+SQL fixtures; they are not yet streamed on `workspace_changes`.
- **Inbound webhooks** ack then `queueMicrotask` — not a durable worker. Outbound retries are attempted in tests, not a background scheduler.
- **GitLab / Slack / Sentry / Zendesk / Front** have adapter stubs only.
- **No email / mobile push** for inbox delivery preferences (in-app checkboxes only).
- **No Linear Asks / AI / SLA / customer requests UI** beyond merge-on-duplicate data.
- **Documents** are plain text notes, not a full editor.
- **Admin:** no teams/members settings UI, no audit log screen, no billing.
- **HashRouter** rather than clean paths.
- **oxlint** still warns about store mutation during render and `Date.now` in timeline/plan views.
- Group headers inside the issue `listbox` are buttons; a skip-to-content link is still missing.
- Board cards remain independently tabbable (list rows now use roving tabindex).

## Performance measurements

Taken 2026-09-11 on this machine via `npx vitest run src/lib/performance.test.ts`:

| Scenario | Result |
| --- | --- |
| `issuesForView` over **5,000** issues | **8.55ms** (4,750 all / 250 inbox) |
| `splitInbox` **2,000** notifications | **0.64ms** |
| `visibleRange` for **10,000** 34px rows | **&lt;1ms**, window &lt; 80 rows |
| 100-item triage session | unit test in `src/lib/triage.test.ts` |
| 10,000-change catch-up | `server/live.test.ts` (Milestone 4) |
| Production JS bundle | **470.3 kB** / **135.6 kB** gzip (`vite build`) |

Online success path: no loading spinner (optimistic store + ImmediateAck / GraphQL ack).

## Accessibility findings

**Fixed this audit (with tests):**

- Composer, command palette, and help are `role="dialog"` + `aria-modal`.
- Persist / reconnect banner is `role="status"` `aria-live="polite"` and does not set `aria-busy`.
- Issue list is a multiselect `listbox`; rows are `option`s; only the highlighted row is `tabIndex={0}`.
- Inbox Queue / Priority / Other is a `tablist`.
- `<main id="nock-main">` and sidebar `nav` have accessible names.

**Still open:**

- No skip link to `#nock-main`.
- Issue group headers are focusable buttons inside the listbox.
- Board columns/cards are not a grid with roving tabindex.
- Notification rows are clickable `option`s but not a complete ARIA keyboard widget (J/K still work via the command system).
- No automated axe run in CI.

## Architectural debt

- `NockStore` is the composition root: UI, persist, sync, planning, triage, inbox, integrations.
- Dual backends (`ImmediateAckBackend` vs `GraphQLSyncBackend`) must stay in lockstep on `lastSyncId` rules.
- PGlite is excellent for the Mac app; multi-user production still needs hosted Postgres + real auth.
- Integration processing is in-process, not an outbox consumer with crash recovery.
- Seed-roadmap vs GraphQL fixtures can drift (client snapshot vs `server/fixtures.ts`).
- Hash history complicates copy-paste URLs versus Linear’s pathnames.

## Recommended next five tasks

1. **Hosted auth + Postgres** — replace header auth with session/OAuth; keep IndexedDB as cache.
2. **Stream notifications and external links** on `workspace_changes` so a second client sees inbox and PR links.
3. **Durable webhook worker** — persist inbound receipts, process from `external_events`, schedule outbound backoff instead of inline `fetch`.
4. **Implement Slack (or GitLab) beyond the stub** using the same `ExternalLink` / `IntegrationCommand` path.
5. **Axe + skip link + board roving tabindex** in CI, plus screenshot snapshots for list/board/inbox.

## How to run

```bash
cd /Users/nico-yardlogix/Downloads/nock
npm run dev          # Vite :5173
npm run api          # GraphQL + PGlite :8787, /sync, /integrations/:provider/webhook
npm run dev:sync     # both
npx tsc -b && npx oxlint src server && npm test
npm run test:e2e
```

Mac app: `~/Applications/Nock.app` and `/Applications/Nock.app` (rebuilt after each milestone).
