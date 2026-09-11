# Linear UX notes for Nock

Researched **inside Cursor** from Linear’s public docs (not Parallel, not Linear source, not their assets). Use this as a product spec. Do not copy Linear’s name, logo, or client code.

## How Linear is structured

From [Concepts](https://linear.app/docs/conceptual-model) and [Intro to Linear](https://linear.app/learn/intro-to-linear):

- **Workspace** → **teams** → **issues**
- An issue belongs to one team and moves through that team’s **workflow**
- **Projects** group issues around a launch (weeks/months). **Milestones** sit inside a project. **Initiatives** sit above projects (quarters).
- **Cycles** are the team’s repeating planning window
- **Views** are filters over the same objects. They do not change the work.

Nock already has the small slice: workspace, one team, issues, workflow states, projects, one cycle, a few views.

## What makes the UI feel like Linear

### 1. Keyboard is the product

From [joining a team](https://linear.app/docs/joining-your-team-on-linear), [create issues](https://linear.app/docs/creating-issues), [select issues](https://linear.app/docs/select-issues), [peek](https://linear.app/docs/peek), [board](https://linear.app/docs/board-layout), [display options](https://linear.app/docs/display-options), [filters](https://linear.app/docs/filters), [triage](https://linear.app/docs/triage):

| Shortcut | Linear | Nock today |
| --- | --- | --- |
| `⌘K` | Command menu for *everything* | Commands + issue search |
| `C` | Composer | Yes |
| `V` | Full-screen create | Missing |
| `?` / `⌘/` | Shortcut help | Missing |
| `J` `K` / arrows | Highlight row | Moves selection |
| `X` | Select (checkbox). Highlight ≠ select | Click = selected + peek |
| `Space` | Peek (Quick Look). Hold = temporary | Peek is a persistent split |
| `Esc` | Clear overlay, then selection | Closes overlays / peek |
| `F` | Filters | Missing |
| `Shift+V` | Display options | Missing |
| `⌘B` | Toggle list/board **on the same view** | Separate `/eng/board` route |
| `P` `T` `A` | Priority / status / assignee | Yes |
| `G` then letter | Go to Inbox / My issues / Triage / … | Partial (`I M A B P C`) |
| `O` then `V` / `T` | Open views / team triage | Missing |
| `1` `2` `3` `H` | Triage: accept / duplicate / decline / snooze | Missing |

Linear’s important distinction: **highlight** (hover or `J`/`K`) vs **select** (`X`). Shortcuts apply to the highlighted issue; bulk actions need a selection. Nock collapses those into one “selected row + always-on peek.”

Peek is [keyboard-only](https://linear.app/docs/peek), like macOS Quick Look: tap Space to pin, hold Space to preview, arrows move the preview, Esc closes. Command menu also peeks items as you move.

### 2. List and board are one view

[Board layout](https://linear.app/docs/board-layout): almost every issue view can be list *or* board. `⌘B` flips layout. Ordering is shared. Board defaults to grouping by status. Cards do **not** show descriptions; Space peeks. Empty columns can hide. `S` + keyboard puts a moved issue at the **top** of the column.

Nock uses different URLs for list vs board, and board previously omitted backlog/done until we patched filters.

### 3. Filters vs display options

- [Filters](https://linear.app/docs/filters) (`F`) **remove** issues from the view. They live in the URL.
- [Display options](https://linear.app/docs/display-options) (`Shift+V`) change grouping, ordering, and which properties show on the row/card. They do not hide issues (except empty groups / sub-issues / triage).

Grouping: status, assignee, project, priority, cycle, label, parent, team. Ordering: status, manual, priority, created, updated, due date. List-by-status orders **closest to done first**. Manual order is workspace-global.

### 4. Triage is a queue, not “Inbox of all new notes”

From [Triage](https://linear.app/docs/triage): incoming work sits **outside** the normal workflow. Default views **exclude** triage. `G` then `T` opens it. Actions: accept `1`, duplicate `2`, decline `3`, snooze `H`. Nock’s Inbox is just “status = Triage,” which is the right *model* but not yet a dedicated review queue.

### 5. Visual density (unofficial, third-party)

Linear does not publish a public design-system site. Independent writeups describe: near-black surfaces, one accent, Inter, **13px** UI type, **4px** grid, list rows about **32–36px**. See [Linear Design System, Decoded](https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026) and [DesignSystems.one](https://www.designsystems.one/design-systems/linear). Treat those as observations, not tokens to copy 1:1.

Nock is already in that neighborhood (13px, dark chrome, overlay Mac titlebar). Gaps are interaction, not paint.

## Highest-leverage Nock work

Do these in order. Each is a Linear *behavior*, implemented originally.

1. **Highlight vs select + Space peek** — `J`/`K` highlights; click or `X` selects; Space opens/closes peek; Esc deselects. Command menu should preview the focused issue.
2. **`⌘B` on the current view** — stop treating Board as a separate place. Keep grouping/order when flipping layout.
3. **`F` filters** — at least assignee, status, priority, project, cycle. Reflect them in the hash URL.
4. **Display options** — grouping (status / priority / assignee / project / none) and visible row properties (id, cycle, project, labels).
5. **Shortcut overlay** — `⌘/` and `?`.
6. **Triage actions** — accept to default status, decline → canceled, with `1`/`3`.
7. **Bulk bar** — when multiple rows are selected, show status / assignee / priority at the bottom.

Skip for now: initiatives, swimlanes, AI filters, Slack, templates, full-screen `V` create, view subscriptions.

## Sources

- [Linear concepts](https://linear.app/docs/conceptual-model)
- [Intro to Linear](https://linear.app/learn/intro-to-linear)
- [Create issues](https://linear.app/docs/creating-issues)
- [Select issues](https://linear.app/docs/select-issues)
- [Peek](https://linear.app/docs/peek)
- [Board layout](https://linear.app/docs/board-layout)
- [Display options](https://linear.app/docs/display-options)
- [Filters](https://linear.app/docs/filters)
- [Custom views](https://linear.app/docs/custom-views)
- [Triage](https://linear.app/docs/triage)
- [Joining your team](https://linear.app/docs/joining-your-team-on-linear)
- [Priority](https://linear.app/docs/priority)
- [Issue status](https://linear.app/docs/configuring-workflows)
- [Linear Design System, Decoded](https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026) (unofficial)
- [DesignSystems.one — Linear](https://www.designsystems.one/design-systems/linear) (unofficial)
