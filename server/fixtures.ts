import { createBootstrapSnapshot, IDS } from '../src/lib/seed.ts'
import type { AuthContext } from './auth.ts'
import type { Database } from './db.ts'

export { IDS }

export async function seedWorkspace(
  db: Database,
  options?: { demo?: boolean; now?: number },
): Promise<AuthContext> {
  const snapshot = createBootstrapSnapshot(options)
  const now = options?.now ?? Date.now()
  const workspaceId = snapshot.workspace.id

  await db.query(
    `INSERT INTO workspaces (id, name, url_key, change_sequence, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (id) DO NOTHING`,
    [
      snapshot.workspace.id,
      snapshot.workspace.name,
      snapshot.workspace.urlKey,
      snapshot.lastSyncId,
      now,
    ],
  )

  for (const user of snapshot.users) {
    await db.query(
      `INSERT INTO users (id, name, email, initials, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.name, user.email, user.initials, now],
    )
    await db.query(
      `INSERT INTO memberships (workspace_id, user_id, role, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [workspaceId, user.id, user.id === snapshot.currentUserId ? 'owner' : 'member', now],
    )
  }

  for (const team of snapshot.teams) {
    await db.query(
      `INSERT INTO teams (
         id, workspace_id, key, name, issue_counter, private, cycle_duration_weeks,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,false,2,$6,$6)
       ON CONFLICT (id) DO NOTHING`,
      [team.id, workspaceId, team.key, team.name, team.issueCounter, now],
    )
    for (const user of snapshot.users) {
      await db.query(
        `INSERT INTO team_memberships (workspace_id, team_id, user_id, role, created_at)
         VALUES ($1,$2,$3,'member',$4)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [workspaceId, team.id, user.id, now],
      )
    }
  }

  for (const state of snapshot.states) {
    await db.query(
      `INSERT INTO workflow_states (
         id, workspace_id, team_id, name, type, color, position, is_default
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        state.id,
        workspaceId,
        state.teamId,
        state.name,
        state.type,
        state.color,
        state.position,
        state.isDefault,
      ],
    )
  }

  for (const label of snapshot.labels) {
    await db.query(
      `INSERT INTO labels (id, workspace_id, team_id, name, color)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [label.id, workspaceId, label.teamId, label.name, label.color],
    )
  }

  for (const project of snapshot.projects) {
    await db.query(
      `INSERT INTO projects (
         id, workspace_id, team_id, name, description, summary, status, health, area,
         lead_id, start_at, target_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        project.id,
        workspaceId,
        project.teamId,
        project.name,
        project.description,
        project.summary ?? '',
        project.status,
        project.health,
        project.area,
        project.leadId ?? null,
        project.startAt ?? null,
        project.targetAt ?? null,
        project.createdAt,
        project.updatedAt,
      ],
    )
    await db.query(
      `INSERT INTO project_teams (workspace_id, project_id, team_id) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, team_id) DO NOTHING`,
      [workspaceId, project.id, project.teamId],
    )
    for (const teamId of project.teamIds ?? []) {
      await db.query(
        `INSERT INTO project_teams (workspace_id, project_id, team_id) VALUES ($1,$2,$3)
         ON CONFLICT (project_id, team_id) DO NOTHING`,
        [workspaceId, project.id, teamId],
      )
    }
    for (const userId of project.memberIds ?? []) {
      await db.query(
        `INSERT INTO project_members (workspace_id, project_id, user_id, role)
         VALUES ($1,$2,$3,'member')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [workspaceId, project.id, userId],
      )
    }
  }

  for (const cycle of snapshot.cycles) {
    await db.query(
      `INSERT INTO cycles (
         id, workspace_id, team_id, number, starts_at, ends_at, completed_at,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        cycle.id,
        workspaceId,
        cycle.teamId,
        cycle.number,
        cycle.startsAt,
        cycle.endsAt,
        cycle.completedAt ?? null,
        cycle.createdAt,
        cycle.updatedAt,
      ],
    )
  }

  for (const milestone of snapshot.milestones) {
    await db.query(
      `INSERT INTO milestones (
         id, workspace_id, project_id, name, target_at, sort_order, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        milestone.id,
        workspaceId,
        milestone.projectId,
        milestone.name,
        milestone.targetAt ?? null,
        milestone.sortOrder,
        now,
      ],
    )
  }

  for (const issue of snapshot.issues) {
    await db.query(
      `INSERT INTO issues (
         id, workspace_id, team_id, number, identifier, title, description, priority,
         state_id, assignee_id, project_id, cycle_id, milestone_id, parent_id, due_at,
         sort_order, revision, archived_at, created_at, updated_at, last_mutation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,NULL,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      [
        issue.id,
        workspaceId,
        issue.teamId,
        issue.number,
        issue.identifier,
        issue.title,
        issue.description,
        issue.priority,
        issue.stateId,
        issue.assigneeId,
        issue.projectId,
        issue.cycleId,
        issue.milestoneId,
        issue.sortOrder,
        issue.revision,
        issue.archivedAt,
        issue.createdAt,
        issue.updatedAt,
        issue.lastMutationId,
      ],
    )
    for (const labelId of issue.labelIds) {
      await db.query(
        `INSERT INTO issue_labels (workspace_id, issue_id, label_id) VALUES ($1,$2,$3)
         ON CONFLICT (issue_id, label_id) DO NOTHING`,
        [workspaceId, issue.id, labelId],
      )
    }
    for (const userId of issue.subscriberIds) {
      await db.query(
        `INSERT INTO issue_subscribers (workspace_id, issue_id, user_id) VALUES ($1,$2,$3)
         ON CONFLICT (issue_id, user_id) DO NOTHING`,
        [workspaceId, issue.id, userId],
      )
    }
  }

  for (const initiative of snapshot.initiatives ?? []) {
    await db.query(
      `INSERT INTO initiatives (
         id, workspace_id, name, description, owner_id, lead_team_id, status, priority,
         target_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        initiative.id,
        workspaceId,
        initiative.name,
        initiative.description,
        initiative.ownerId,
        initiative.leadTeamId,
        initiative.status,
        initiative.priority,
        initiative.targetAt,
        initiative.createdAt,
        initiative.updatedAt,
      ],
    )
    for (const projectId of initiative.projectIds) {
      await db.query(
        `INSERT INTO initiative_projects (workspace_id, initiative_id, project_id)
         VALUES ($1,$2,$3)
         ON CONFLICT (initiative_id, project_id) DO NOTHING`,
        [workspaceId, initiative.id, projectId],
      )
    }
  }

  for (const doc of snapshot.documents ?? []) {
    await db.query(
      `INSERT INTO documents (
         id, workspace_id, project_id, initiative_id, title, body, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        doc.id,
        workspaceId,
        doc.projectId,
        doc.initiativeId,
        doc.title,
        doc.body,
        doc.createdAt,
        doc.updatedAt,
      ],
    )
  }

  return {
    db,
    userId: snapshot.currentUserId,
    workspaceId,
  }
}

export async function seedPrivateTeam(
  db: Database,
  workspaceId: string,
  options?: { id?: string; memberIds?: string[] },
): Promise<string> {
  const now = Date.now()
  const teamId = options?.id ?? 'team_design'
  await db.query(
    `INSERT INTO teams (
       id, workspace_id, key, name, issue_counter, private, cycle_duration_weeks,
       created_at, updated_at
     ) VALUES ($1,$2,'DES','Design',0,true,2,$3,$3)
     ON CONFLICT (id) DO NOTHING`,
    [teamId, workspaceId, now],
  )
  await db.query(
    `INSERT INTO workflow_states (
       id, workspace_id, team_id, name, type, color, position, is_default
     ) VALUES ($1,$2,$3,'Todo','unstarted','#e2e2e2',0,true)
     ON CONFLICT (id) DO NOTHING`,
    [`${teamId}_todo`, workspaceId, teamId],
  )
  for (const userId of options?.memberIds ?? []) {
    await db.query(
      `INSERT INTO team_memberships (workspace_id, team_id, user_id, role, created_at)
       VALUES ($1,$2,$3,'member',$4)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [workspaceId, teamId, userId, now],
    )
  }
  return teamId
}
