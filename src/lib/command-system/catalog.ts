import type { IssuePatch } from '../commands'
import { cloneIssue, uniqueIds, withId, withoutId } from '../issue-model'
import { collectionPath, identifierFromPath, issuePeekPath } from '../paths'
import type { Issue, Priority, PropertyMenuKind } from '../types'
import type { CommandSystem } from './system'
import type { CommandArgs, CommandContext, CommandResult } from './types'

function actionIds(ctx: CommandContext, args?: CommandArgs): string[] {
  const explicit = args?.issueIds
  if (Array.isArray(explicit)) return uniqueIds(explicit.filter((id): id is string => typeof id === 'string'))
  return ctx.actionIds()
}

function hasTargets(ctx: CommandContext, args?: CommandArgs): boolean {
  return actionIds(ctx, args).length > 0
}

function subscribed(issue: Issue, userId: string): boolean {
  return issue.subscriberIds.includes(userId)
}

function applyPatches(
  ctx: CommandContext,
  system: CommandSystem,
  label: string,
  ids: string[],
  nextFor: (issue: Issue) => IssuePatch | null,
): CommandResult {
  const patches: Array<{ id: string; patch: IssuePatch }> = []
  const inverse: Array<{ id: string; patch: IssuePatch }> = []
  for (const id of ids) {
    const issue = ctx.store.issue(id)
    if (!issue) continue
    const patch = nextFor(issue)
    if (!patch) continue
    const before: IssuePatch = {}
    for (const key of Object.keys(patch) as Array<keyof IssuePatch>) {
      const value = issue[key as keyof Issue]
      ;(before as Record<string, unknown>)[key as string] = Array.isArray(value)
        ? [...value]
        : value
    }
    if (patch.teamId !== undefined) {
      before.number = issue.number
      before.identifier = issue.identifier
      before.teamId = issue.teamId
    }
    inverse.push({ id, patch: before })
    patches.push({ id, patch })
  }
  if (patches.length === 0) return { ok: false, error: 'nothing to change' }
  for (const row of patches) ctx.store.updateIssue(row.id, row.patch)
  system.undo.push(label, [{ type: 'issue.patch', patches: inverse }])
  ctx.store.ui.propertyMenu = null
  ctx.store.dropModal('property')
  return { ok: true }
}

function picker(ctx: CommandContext, kind: PropertyMenuKind): CommandResult {
  ctx.store.openPropertyMenu(kind)
  if (!ctx.store.ui.propertyMenu) return { ok: false, error: 'unavailable' }
  return { ok: true }
}

function stringArg(args: CommandArgs | undefined, key: string): string | undefined {
  const value = args?.[key]
  return typeof value === 'string' ? value : undefined
}

function nullableString(args: CommandArgs | undefined, key: string): string | null | undefined {
  const value = args?.[key]
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return String(value)
}

export function registerCatalog(system: CommandSystem): void {
  const { registry } = system

  registry.register({
    id: 'command.palette',
    label: 'Command palette',
    shortcut: { key: 'k', mod: true, whenTyping: 'always' },
    palette: false,
    when: () => true,
    run: (ctx) => {
      if (ctx.store.ui.commandOpen) {
        ctx.store.closeCommand()
        system.restoreFocusIfQuiet()
        return { ok: true }
      }
      system.captureFocus()
      ctx.store.openCommand()
      return { ok: true }
    },
  })

  registry.register({
    id: 'surface.dismiss',
    label: 'Dismiss',
    shortcut: { key: 'Escape', whenTyping: 'always' },
    palette: false,
    when: () => true,
    run: (ctx) => {
      const top = ctx.store.ui.modalStack[ctx.store.ui.modalStack.length - 1]
      const blocking =
        top === 'help' ||
        top === 'display' ||
        top === 'filter' ||
        top === 'property' ||
        top === 'command' ||
        top === 'composer'
      if (blocking) {
        ctx.store.dismissOverlays()
        system.restoreFocusIfQuiet()
        return { ok: true }
      }
      if (identifierFromPath(ctx.pathname) && ctx.navigate) {
        ctx.navigate(-1)
        return { ok: true }
      }
      ctx.store.dismissOverlays()
      system.restoreFocusIfQuiet()
      return { ok: true }
    },
  })

  registry.register({
    id: 'edit.undo',
    label: 'Undo',
    shortcut: { key: 'z', mod: true },
    palette: false,
    when: () => system.undo.depth > 0,
    run: (ctx) => {
      const ok = system.undo.undo(ctx.store)
      return ok ? { ok: true } : { ok: false, error: 'nothing to undo' }
    },
  })

  registry.register({
    id: 'issue.create',
    label: 'New issue',
    shortcut: { key: 'c' },
    keywords: ['create', 'new'],
    when: () => true,
    run: (ctx, args) => {
      const title = stringArg(args, 'title')
      if (title) {
        const parentId = stringArg(args, 'parentId') ?? null
        const issue = ctx.store.createIssue({ title, parentId })
        system.undo.push('Create issue', [
          { type: 'issue.delete', ids: [issue.id] },
        ])
        return { ok: true, issueId: issue.id }
      }
      system.captureFocus()
      ctx.store.openComposer(ctx.view)
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.open',
    label: 'Open issue',
    shortcut: { key: ' ' },
    keywords: ['peek', 'preview'],
    palette: false,
    when: (ctx) => Boolean(ctx.highlightedId() || ctx.actionIds()[0]),
    run: (ctx, args) => {
      const id = stringArg(args, 'id') ?? ctx.highlightedId() ?? ctx.actionIds()[0]
      if (!id) return { ok: false, error: 'no issue' }
      const issue = ctx.store.issue(id)
      if (!issue) return { ok: false, error: 'no issue' }
      if (ctx.store.ui.peekOpen && ctx.store.ui.highlightedIssueId === id && !args?.id) {
        if (identifierFromPath(ctx.pathname) && ctx.navigate) {
          ctx.navigate(-1)
          return { ok: true }
        }
        ctx.store.togglePeek()
        return { ok: true }
      }
      let scrollTop = ctx.store.ui.listScrollTop
      if (typeof document !== 'undefined' && typeof HTMLElement !== 'undefined') {
        const list = document.querySelector('[data-testid=issue-list]')
        if (list instanceof HTMLElement && list.scrollTop > 0) scrollTop = list.scrollTop
      }
      ctx.store.rememberCollection({
        pathname: collectionPath(ctx.view),
        search: ctx.search,
        scrollTop,
        highlightId: issue.id,
        selectedIds: [...ctx.store.ui.selectedIssueIds],
      })
      ctx.store.openIssuePeek(id)
      if (ctx.view !== 'projects' && ctx.view !== 'cycles') {
        ctx.navigate?.(issuePeekPath(ctx.view, issue.identifier))
      }
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.navigate',
    label: 'Highlight issue',
    palette: false,
    when: (ctx) => ctx.issues().length > 0,
    run: (ctx, args) => {
      const delta = typeof args?.delta === 'number' ? args.delta : 1
      const extend = Boolean(args?.extend)
      if (extend && !ctx.store.ui.selectionAnchorId) {
        ctx.store.ui.selectionAnchorId = ctx.store.ui.highlightedIssueId
      }
      ctx.store.highlightRelative(ctx.view, delta)
      const id = ctx.store.ui.highlightedIssueId
      if (extend && id) system.selection.range(ctx.view, id)
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.setStatus',
    label: 'Set status',
    shortcut: { key: 't' },
    keywords: ['state', 'workflow'],
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      const stateId = stringArg(args, 'stateId') ?? stringArg(args, 'value')
      if (!stateId) return picker(ctx, 'status')
      if (ctx.store.ui.composerOpen) {
        ctx.store.applyProperty('status', stateId)
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set status', actionIds(ctx, args), () => ({
        stateId,
      }))
    },
  })

  registry.register({
    id: 'issue.setPriority',
    label: 'Set priority',
    shortcut: { key: 'p' },
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      const raw = args?.priority ?? args?.value
      if (raw === undefined) return picker(ctx, 'priority')
      const priority = Number(raw) as Priority
      if (ctx.store.ui.composerOpen) {
        ctx.store.applyProperty('priority', priority)
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set priority', actionIds(ctx, args), () => ({
        priority,
      }))
    },
  })

  registry.register({
    id: 'issue.setAssignee',
    label: 'Set assignee',
    shortcut: { key: 'a' },
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      if (!('assigneeId' in (args ?? {})) && args?.value === undefined) {
        return picker(ctx, 'assignee')
      }
      const assigneeId = nullableString(args, 'assigneeId') ?? nullableString(args, 'value') ?? null
      if (ctx.store.ui.composerOpen) {
        ctx.store.applyProperty('assignee', assigneeId)
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set assignee', actionIds(ctx, args), () => ({
        assigneeId,
      }))
    },
  })

  registry.register({
    id: 'issue.addLabel',
    label: 'Add label',
    shortcut: { key: 'l' },
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      const labelId = stringArg(args, 'labelId') ?? stringArg(args, 'value')
      if (!labelId) return picker(ctx, 'label')
      if (ctx.store.ui.composerOpen) {
        const ids = withId(ctx.store.ui.composer.labelIds, labelId)
        ctx.store.setComposer({ labelIds: ids })
        ctx.store.ui.propertyMenu = null
        ctx.store.dropModal('property')
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Add label', actionIds(ctx, args), (issue) =>
        issue.labelIds.includes(labelId) ? null : { labelIds: withId(issue.labelIds, labelId) },
      )
    },
  })

  registry.register({
    id: 'issue.removeLabel',
    label: 'Remove label',
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      const labelId = stringArg(args, 'labelId') ?? stringArg(args, 'value')
      if (!labelId) return picker(ctx, 'label')
      if (ctx.store.ui.composerOpen) {
        ctx.store.setComposer({
          labelIds: withoutId(ctx.store.ui.composer.labelIds, labelId),
        })
        ctx.store.ui.propertyMenu = null
        ctx.store.dropModal('property')
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Remove label', actionIds(ctx, args), (issue) =>
        issue.labelIds.includes(labelId)
          ? { labelIds: withoutId(issue.labelIds, labelId) }
          : null,
      )
    },
  })

  registry.register({
    id: 'issue.setProject',
    label: 'Set project',
    shortcut: { key: 'p', shift: true },
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      if (!('projectId' in (args ?? {})) && args?.value === undefined) {
        return picker(ctx, 'project')
      }
      const projectId = nullableString(args, 'projectId') ?? nullableString(args, 'value') ?? null
      if (ctx.store.ui.composerOpen) {
        ctx.store.applyProperty('project', projectId)
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set project', actionIds(ctx, args), () => ({
        projectId,
      }))
    },
  })

  registry.register({
    id: 'issue.setCycle',
    label: 'Set cycle',
    when: (ctx) => ctx.hasAction(),
    run: (ctx, args) => {
      if (!('cycleId' in (args ?? {})) && args?.value === undefined) {
        return picker(ctx, 'cycle')
      }
      const cycleId = nullableString(args, 'cycleId') ?? nullableString(args, 'value') ?? null
      if (ctx.store.ui.composerOpen) {
        ctx.store.applyProperty('cycle', cycleId)
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set cycle', actionIds(ctx, args), () => ({
        cycleId,
      }))
    },
  })

  registry.register({
    id: 'issue.setMilestone',
    label: 'Set milestone',
    shortcut: { key: 'm', shift: true },
    when: (ctx) => ctx.hasAction() && ctx.store.milestones.size > 0,
    run: (ctx, args) => {
      if (!('milestoneId' in (args ?? {})) && args?.value === undefined) {
        return picker(ctx, 'milestone')
      }
      const milestoneId =
        nullableString(args, 'milestoneId') ?? nullableString(args, 'value') ?? null
      if (ctx.store.ui.composerOpen) {
        ctx.store.setComposer({ milestoneId })
        ctx.store.ui.propertyMenu = null
        ctx.store.dropModal('property')
        return { ok: true }
      }
      return applyPatches(ctx, system, 'Set milestone', actionIds(ctx, args), () => ({
        milestoneId,
      }))
    },
  })

  registry.register({
    id: 'issue.moveTeam',
    label: 'Move to team',
    when: (ctx) => ctx.hasAction() && ctx.store.teams.size > 1,
    run: (ctx, args) => {
      const teamId = stringArg(args, 'teamId') ?? stringArg(args, 'value')
      if (!teamId) return picker(ctx, 'team')
      return applyPatches(ctx, system, 'Move team', actionIds(ctx, args), (issue) => {
        if (issue.teamId === teamId) return null
        const type = ctx.store.states.get(issue.stateId)?.type
        const dest =
          ctx.store.statesForTeam(teamId).find((state) => state.type === type) ??
          ctx.store.defaultState(teamId)
        return { teamId, stateId: dest.id }
      })
    },
  })

  registry.register({
    id: 'issue.createSubissue',
    label: 'Create sub-issue',
    keywords: ['child', 'subissue'],
    when: (ctx) => ctx.actionIds().length > 0,
    run: (ctx, args) => {
      const parentId = stringArg(args, 'parentId') ?? ctx.actionIds()[0]
      if (!parentId) return { ok: false, error: 'no parent issue' }
      const title = stringArg(args, 'title')
      if (title) {
        const issue = ctx.store.createIssue({ title, parentId })
        system.undo.push('Create sub-issue', [{ type: 'issue.delete', ids: [issue.id] }])
        return { ok: true, issueId: issue.id }
      }
      system.captureFocus()
      ctx.store.openComposer(ctx.view, { parentId })
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.subscribe',
    label: 'Subscribe',
    shortcut: { key: 's', shift: true },
    when: (ctx) =>
      hasTargets(ctx) &&
      actionIds(ctx).some((id) => {
        const issue = ctx.store.issue(id)
        return issue ? !subscribed(issue, ctx.store.currentUserId) : false
      }),
    run: (ctx, args) => {
      const userId = ctx.store.currentUserId
      return applyPatches(ctx, system, 'Subscribe', actionIds(ctx, args), (issue) =>
        subscribed(issue, userId)
          ? null
          : { subscriberIds: withId(issue.subscriberIds, userId) },
      )
    },
  })

  registry.register({
    id: 'issue.unsubscribe',
    label: 'Unsubscribe',
    when: (ctx) =>
      hasTargets(ctx) &&
      actionIds(ctx).some((id) => {
        const issue = ctx.store.issue(id)
        return issue ? subscribed(issue, ctx.store.currentUserId) : false
      }),
    run: (ctx, args) => {
      const userId = ctx.store.currentUserId
      return applyPatches(ctx, system, 'Unsubscribe', actionIds(ctx, args), (issue) =>
        subscribed(issue, userId)
          ? { subscriberIds: withoutId(issue.subscriberIds, userId) }
          : null,
      )
    },
  })

  registry.register({
    id: 'issue.archive',
    label: 'Archive',
    when: (ctx) =>
      hasTargets(ctx) &&
      actionIds(ctx).some((id) => ctx.store.issue(id)?.archivedAt == null),
    run: (ctx, args) => {
      const now = Date.now()
      return applyPatches(ctx, system, 'Archive', actionIds(ctx, args), (issue) =>
        issue.archivedAt ? null : { archivedAt: now },
      )
    },
  })

  registry.register({
    id: 'issue.delete',
    label: 'Delete issue',
    keywords: ['remove'],
    when: (ctx) => hasTargets(ctx),
    run: (ctx, args) => {
      const ids = actionIds(ctx, args)
      const snapshots = ids
        .map((id) => ctx.store.issue(id))
        .filter((issue): issue is Issue => Boolean(issue))
        .map(cloneIssue)
      if (snapshots.length === 0) return { ok: false, error: 'no issue' }
      for (const issue of snapshots) ctx.store.deleteIssue(issue.id)
      system.undo.push('Delete issue', [{ type: 'issue.restore', issues: snapshots }])
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.relate',
    label: 'Mark related',
    when: (ctx) => ctx.selectedCount() >= 2,
    run: (ctx, args) => {
      const ids = actionIds(ctx, args)
      if (ids.length < 2) return { ok: false, error: 'select at least two issues' }
      const hub = ids[0]
      return applyPatches(ctx, system, 'Relate issues', ids, (issue) => {
        const next = [...issue.relatedIssueIds]
        for (const other of ids) {
          if (other !== issue.id && !next.includes(other)) next.push(other)
        }
        if (issue.id !== hub && !next.includes(hub)) next.push(hub)
        return JSON.stringify(next) === JSON.stringify(issue.relatedIssueIds)
          ? null
          : { relatedIssueIds: next }
      })
    },
  })

  registry.register({
    id: 'issue.block',
    label: 'Mark blocked',
    when: (ctx) => ctx.selectedCount() >= 2,
    run: (ctx, args) => {
      const ids = actionIds(ctx, args)
      if (ids.length < 2) return { ok: false, error: 'select at least two issues' }
      const blocker = ids[0]
      return applyPatches(ctx, system, 'Block issues', ids.slice(1), (issue) =>
        issue.blockedByIds.includes(blocker)
          ? null
          : { blockedByIds: withId(issue.blockedByIds, blocker) },
      )
    },
  })

  registry.register({
    id: 'issue.markDuplicate',
    label: 'Mark duplicate',
    when: (ctx) => ctx.selectedCount() >= 2,
    run: (ctx, args) => {
      const ids = actionIds(ctx, args)
      if (ids.length < 2) return { ok: false, error: 'select at least two issues' }
      const canonical = ids[0]
      const teamId = ctx.store.issue(canonical)?.teamId ?? ctx.store.defaultTeam().id
      const duplicate =
        ctx.store.statesForTeam(teamId).find((state) => state.type === 'duplicate') ??
        ctx.store.canceledState(teamId)
      if (!duplicate) return { ok: false, error: 'no duplicate state' }
      return applyPatches(ctx, system, 'Mark duplicate', ids.slice(1), () => ({
        duplicateOfId: canonical,
        stateId: duplicate.id,
      }))
    },
  })

  registry.register({
    id: 'issue.acceptTriage',
    label: 'Accept from inbox',
    shortcut: { key: '1' },
    when: (ctx) => ctx.view === 'inbox' && ctx.actionIds().length > 0,
    run: (ctx) => {
      const ids = ctx.actionIds()
      const inverse: Array<{ id: string; patch: IssuePatch }> = ids
        .map((id) => ctx.store.issue(id))
        .filter((issue): issue is Issue => Boolean(issue))
        .map((issue) => ({ id: issue.id, patch: { stateId: issue.stateId } }))
      ctx.store.execute({ type: 'issue.acceptTriage', view: 'inbox' })
      if (inverse.length) system.undo.push('Accept triage', [{ type: 'issue.patch', patches: inverse }])
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.declineTriage',
    label: 'Decline from inbox',
    shortcut: { key: '3' },
    when: (ctx) => ctx.view === 'inbox' && ctx.actionIds().length > 0,
    run: (ctx) => {
      const ids = ctx.actionIds()
      const inverse: Array<{ id: string; patch: IssuePatch }> = ids
        .map((id) => ctx.store.issue(id))
        .filter((issue): issue is Issue => Boolean(issue))
        .map((issue) => ({ id: issue.id, patch: { stateId: issue.stateId } }))
      ctx.store.execute({ type: 'issue.declineTriage', view: 'inbox' })
      if (inverse.length) system.undo.push('Decline triage', [{ type: 'issue.patch', patches: inverse }])
      return { ok: true }
    },
  })

  registry.register({
    id: 'issue.boardShift',
    label: 'Move board column',
    palette: false,
    when: (ctx) =>
      ctx.store.effectiveLayout(ctx.view) === 'board' && Boolean(ctx.highlightedId()),
    run: (ctx, args) => {
      const delta = typeof args?.delta === 'number' ? args.delta : 1
      const issue = ctx.store.highlightedIssue()
      if (!issue) return { ok: false, error: 'no highlighted issue' }
      const columns = ctx.store.boardStates()
      const index = columns.findIndex((state) => state.id === issue.stateId)
      const next = columns[index + delta]
      if (!next) return { ok: false, error: 'no adjacent column' }
      return system.run('issue.setStatus', { stateId: next.id, issueIds: [issue.id] }, ctx)
    },
  })

  registry.register({
    id: 'selection.toggle',
    label: 'Toggle selected issue',
    shortcut: { key: 'x' },
    palette: false,
    when: () => true,
    run: (_ctx, args) => {
      const id = stringArg(args, 'id')
      if (args?.exclusive && id) {
        system.selection.click(id)
        return { ok: true }
      }
      system.selection.toggle(id)
      return { ok: true }
    },
  })

  registry.register({
    id: 'selection.range',
    label: 'Select issue range',
    palette: false,
    when: (ctx) => ctx.issues().length > 0,
    run: (ctx, args) => {
      const id = stringArg(args, 'id') ?? ctx.highlightedId()
      if (!id) return { ok: false, error: 'no issue' }
      system.selection.range(ctx.view, id)
      return { ok: true }
    },
  })

  registry.register({
    id: 'selection.all',
    label: 'Select all visible issues',
    shortcut: { key: 'a', mod: true },
    palette: false,
    when: (ctx) => ctx.issues().length > 0,
    run: (ctx) => {
      system.selection.all(ctx.view)
      return { ok: true }
    },
  })

  registry.register({
    id: 'selection.clear',
    label: 'Clear selection',
    palette: false,
    when: (ctx) => ctx.selectedCount() > 0,
    run: () => {
      system.selection.clear()
      return { ok: true }
    },
  })

  registry.register({
    id: 'view.toggleLayout',
    label: 'Toggle list / board',
    shortcut: { key: 'b', mod: true },
    when: (ctx) => ctx.view !== 'inbox' && ctx.view !== 'projects' && ctx.view !== 'cycles',
    run: (ctx) => {
      if (ctx.view === 'board') {
        ctx.store.setLayout('list')
        ctx.navigate?.('/eng/all')
        return { ok: true }
      }
      ctx.store.toggleLayout(ctx.view)
      return { ok: true }
    },
  })

  registry.register({
    id: 'view.openFilters',
    label: 'Open filters',
    shortcut: { key: 'f' },
    when: () => true,
    run: (ctx) => {
      ctx.store.toggleFilterMenu()
      return { ok: true }
    },
  })

  registry.register({
    id: 'view.openDisplayOptions',
    label: 'Open display options',
    shortcut: { key: 'v', shift: true },
    when: () => true,
    run: (ctx) => {
      ctx.store.toggleDisplayMenu()
      return { ok: true }
    },
  })

  registry.register({
    id: 'view.openHelp',
    label: 'Keyboard shortcuts',
    shortcut: { key: '?' },
    when: () => true,
    run: (ctx) => {
      if (!ctx.store.ui.helpOpen) {
        system.captureFocus()
        ctx.store.toggleHelp()
      }
      return { ok: true }
    },
  })

  registry.register({
    id: 'nav.inbox',
    label: 'Go to Inbox',
    keywords: ['triage'],
    when: () => true,
    run: (ctx) => {
      ctx.navigate?.('/inbox')
      return { ok: true }
    },
  })

  registry.register({
    id: 'nav.myIssues',
    label: 'Go to My issues',
    when: () => true,
    run: (ctx) => {
      ctx.navigate?.('/my-issues')
      return { ok: true }
    },
  })

  registry.register({
    id: 'nav.all',
    label: 'Go to All issues',
    when: () => true,
    run: (ctx) => {
      ctx.navigate?.('/eng/all')
      return { ok: true }
    },
  })

  registry.register({
    id: 'nav.projects',
    label: 'Go to Projects',
    when: () => true,
    run: (ctx) => {
      ctx.navigate?.('/projects')
      return { ok: true }
    },
  })

  registry.register({
    id: 'nav.cycles',
    label: 'Go to Cycles',
    when: () => true,
    run: (ctx) => {
      ctx.navigate?.('/cycles')
      return { ok: true }
    },
  })

  registry.register({
    id: 'workspace.reload',
    label: 'Reload project map',
    when: () => true,
    run: (ctx) => {
      void ctx.store.resetDemo()
      return { ok: true }
    },
  })

  system.shortcuts.bind({ key: 'k', mod: true, whenTyping: 'always' }, 'command.palette')
  system.shortcuts.bind({ key: 'Escape', whenTyping: 'always' }, 'surface.dismiss')
  system.shortcuts.bind({ key: 'z', mod: true }, 'edit.undo')
  system.shortcuts.bind({ key: 'c' }, 'issue.create')
  system.shortcuts.bind({ key: 'j' }, 'issue.navigate', { delta: 1 })
  system.shortcuts.bind({ key: 'ArrowDown' }, 'issue.navigate', { delta: 1 })
  system.shortcuts.bind({ key: 'k' }, 'issue.navigate', { delta: -1 })
  system.shortcuts.bind({ key: 'ArrowUp' }, 'issue.navigate', { delta: -1 })
  system.shortcuts.bind({ key: 'j', shift: true }, 'issue.navigate', {
    delta: 1,
    extend: true,
  })
  system.shortcuts.bind({ key: 'ArrowDown', shift: true }, 'issue.navigate', {
    delta: 1,
    extend: true,
  })
  system.shortcuts.bind({ key: 'k', shift: true }, 'issue.navigate', {
    delta: -1,
    extend: true,
  })
  system.shortcuts.bind({ key: 'ArrowUp', shift: true }, 'issue.navigate', {
    delta: -1,
    extend: true,
  })
  system.shortcuts.bind({ key: 'x' }, 'selection.toggle')
  system.shortcuts.bind({ key: 'a', mod: true }, 'selection.all')
  system.shortcuts.bind({ key: 'p' }, 'issue.setPriority')
  system.shortcuts.bind({ key: 'l' }, 'issue.addLabel')
  system.shortcuts.bind({ key: 'p', shift: true }, 'issue.setProject')
  system.shortcuts.bind({ key: 'm', shift: true }, 'issue.setMilestone')
  system.shortcuts.bind({ key: 's', shift: true }, 'issue.subscribe')
  system.shortcuts.bind({ key: 't' }, 'issue.setStatus')
  system.shortcuts.bind({ key: 'a' }, 'issue.setAssignee')
  system.shortcuts.bind({ key: 'f' }, 'view.openFilters')
  system.shortcuts.bind({ key: 'v', shift: true }, 'view.openDisplayOptions')
  system.shortcuts.bind({ key: 'b', mod: true }, 'view.toggleLayout')
  system.shortcuts.bind({ key: ' ' }, 'issue.open')
  system.shortcuts.bind({ key: '1' }, 'issue.acceptTriage')
  system.shortcuts.bind({ key: '3' }, 'issue.declineTriage')
  system.shortcuts.bind({ key: '[' }, 'issue.boardShift', { delta: -1 })
  system.shortcuts.bind({ key: ']' }, 'issue.boardShift', { delta: 1 })
  system.shortcuts.bind({ key: '?' }, 'view.openHelp')
  system.shortcuts.bind({ key: '/', mod: true, whenTyping: 'always' }, 'view.openHelp')
}
