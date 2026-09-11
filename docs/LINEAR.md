# Nock ↔ Linear (clean-room notes)

Nock is a **separate** product from Folium. This file records public, observable Linear behavior so Nock can follow the same *ideas* without copying Linear’s source, assets, or trademarks.

Do not paste Linear client code, minified bundles, or anything from unofficial “reverse Linear sync engine” dumps into this repo.

## What Linear actually is

Linear is not a CRUD issue tracker with a thin UI. It is a **local-first sync engine that looks like an issue tracker**.

Public stack (from Linear engineering talks, docs, and hiring posts):

- **Client:** React + TypeScript, MobX object graph, IndexedDB (`idb`), Vite, Radix, Inter. Electron wraps the same web app. Rich text uses ProseMirror; Yjs is used only for the document editor, not for issues.
- **Server:** Node/TypeScript, GraphQL, PostgreSQL, Redis, WebSockets, GCP.
- **Marketing site** is Next.js. **The product app is a CSR SPA**, not RSC.
- **Mobile:** Swift / Kotlin. Not the web client.

## Sync model (the part that makes it feel instant)

1. The UI reads an **in-memory object pool**. IndexedDB is the real client database, not a cache of REST responses.
2. A mutation is written in memory first: `issue.title = "…"; issue.save()`. The UI updates **synchronously**. Network is async.
3. GraphQL mutations return **`lastSyncId`**, not the new issue payload. Fresh data arrives on the sync channel.
4. The server assigns a **monotonic `syncId`**. That total order is last-writer-wins (OT-like), **not a CRDT**, except for ProseMirror docs.
5. Bootstrap + delta (`/sync/bootstrap`, `/sync/delta`) plus WebSocket deltas keep replicas aligned.

Nock v1 implements the client half: object pool + IndexedDB + local `syncId`. There is no server yet. The transaction log is shaped so a later `/sync/delta` can replay it.

## Product model (from Linear docs)

- A **workspace** contains **teams**.
- An **issue** belongs to **one team** and moves through that team’s **workflow**.
- Workflow **state types** (categories, fixed order): `triage | backlog | unstarted | started | completed | canceled | duplicate`.
- Default statuses: Backlog → Todo → In Progress → Done → Canceled. Nock also ships Triage + In Review.
- **Priority:** `0` none, `1` urgent, `2` high, `3` medium, `4` low. Not customizable.
- Identifier: `{TEAM_KEY}-{number}` (e.g. `ENG-123`). Moving teams mints a new identifier.
- **Projects** group issues around an outcome. **Cycles** are the team’s repeating planning window. **Initiatives** sit above projects (not in Nock v1).
- **Views** are filters over the same objects: Inbox (triage), My issues, All, Active (unstarted+started), Backlog, Board.

## Keyboard (public shortcuts)

| Key | Action |
| --- | --- |
| `C` | Create issue |
| `⌘K` / `Ctrl+K` | Command menu |
| `Esc` | Close overlay / peek |
| `J` / `K` | Next / previous issue |
| `P` | Priority |
| `T` | Status |
| `A` | Assignee |
| `G` then `I` `M` `A` `B` `P` `C` | Inbox, My issues, All, Board, Projects, Cycles |
| `⌘Enter` | Submit composer |

## Nock architecture

- Vite + React + TypeScript + Tailwind SPA on port **5173** (never Folium’s 4312).
- `NockStore` is the object pool. React subscribes with `useSyncExternalStore`.
- `IdbPersistence` writes a snapshot after every model mutation. UI paint does not wait for IndexedDB.
- Last writer wins: `applyRemoteIssue` ignores a payload with a lower `syncId`.

## Legal

Nock is not affiliated with Linear. Do not use Linear’s name in the product UI, do not copy logos or screenshots as assets, and do not vendor their client.
