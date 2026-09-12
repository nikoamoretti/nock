-- Nock PostgreSQL schema (PGlite or Postgres 16+).
-- Tenant-scoped tables carry workspace_id. Issue identifiers are team-local.
-- schema_migrations is created by migrate.ts before this file runs.

CREATE TABLE workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  url_key text NOT NULL UNIQUE,
  change_sequence bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  initials text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE memberships (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  created_at bigint NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE teams (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  issue_counter bigint NOT NULL DEFAULT 0,
  private boolean NOT NULL DEFAULT false,
  cycle_duration_weeks integer NOT NULL DEFAULT 2,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (workspace_id, key)
);

CREATE TABLE team_memberships (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  created_at bigint NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE workflow_states (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (
    type IN ('triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled', 'duplicate')
  ),
  color text NOT NULL,
  position integer NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  UNIQUE (id, team_id)
);

CREATE TABLE labels (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  UNIQUE (team_id, name)
);

CREATE TABLE cycles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  number integer NOT NULL,
  starts_at bigint NOT NULL,
  ends_at bigint NOT NULL,
  completed_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (team_id, number)
);

CREATE TABLE projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('planned', 'started', 'completed', 'canceled')),
  health text NOT NULL CHECK (health IN ('on-track', 'at-risk', 'off-track', 'no-update')),
  area text NOT NULL DEFAULT '',
  lead_id text REFERENCES users(id),
  start_at bigint,
  target_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE project_teams (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, team_id)
);

CREATE TABLE project_members (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE milestones (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_at bigint,
  sort_order double precision NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE initiatives (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id text REFERENCES users(id),
  lead_team_id text REFERENCES teams(id),
  status text NOT NULL DEFAULT 'planned',
  priority integer NOT NULL DEFAULT 0,
  target_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE initiative_projects (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  initiative_id text NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (initiative_id, project_id)
);

CREATE TABLE issues (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES teams(id),
  number bigint NOT NULL,
  identifier text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
  state_id text NOT NULL,
  assignee_id text REFERENCES users(id),
  project_id text REFERENCES projects(id),
  cycle_id text REFERENCES cycles(id),
  milestone_id text REFERENCES milestones(id),
  parent_id text REFERENCES issues(id),
  due_at bigint,
  sort_order double precision NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  archived_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  last_mutation_id text,
  UNIQUE (team_id, number),
  UNIQUE (workspace_id, identifier),
  FOREIGN KEY (state_id, team_id) REFERENCES workflow_states (id, team_id)
);

CREATE TABLE issue_labels (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id text NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE issue_relations (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  related_issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('related', 'blocks', 'duplicate')),
  PRIMARY KEY (issue_id, related_issue_id, kind),
  CHECK (issue_id <> related_issue_id)
);

CREATE TABLE issue_subscribers (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, user_id)
);

CREATE TABLE documents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  initiative_id text REFERENCES initiatives(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE comments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE attachments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE activity_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text REFERENCES issues(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id),
  kind text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL
);

CREATE TABLE project_updates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES users(id),
  health text NOT NULL CHECK (health IN ('on-track', 'at-risk', 'off-track', 'no-update')),
  body text NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE customers (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE customer_requests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  issue_id text REFERENCES issues(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE notifications (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  source_type text,
  source_id text,
  read_at bigint,
  archived_at bigint,
  priority_score integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

CREATE TABLE saved_views (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id),
  name text NOT NULL,
  view text NOT NULL,
  layout text NOT NULL,
  group_by text NOT NULL,
  subgroup_by text NOT NULL,
  order_by text NOT NULL,
  display_properties jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ast jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE favorites (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE integration_installations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text,
  status text NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE external_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_id text REFERENCES issues(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL
);

CREATE TABLE webhook_subscriptions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['*']::text[],
  disabled_at bigint,
  fail_count integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE webhook_deliveries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id text NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  delivery_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  timestamp_ms bigint NOT NULL,
  payload jsonb NOT NULL,
  signature text NOT NULL,
  status text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  last_error text,
  created_at bigint NOT NULL
);

CREATE TABLE workspace_changes (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert', 'update', 'archive', 'delete')),
  revision bigint NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  payload jsonb,
  sync_group text,
  authorization_team_id text,
  actor_id text,
  client_mutation_id text,
  created_at bigint NOT NULL,
  PRIMARY KEY (workspace_id, sequence)
);

CREATE TABLE mutation_receipts (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_mutation_id text NOT NULL,
  revision bigint NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (workspace_id, client_mutation_id)
);

CREATE TABLE outbox_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at bigint NOT NULL,
  processed_at bigint
);

CREATE OR REPLACE FUNCTION enforce_issue_invariants() RETURNS trigger AS $issue$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'issue cannot parent itself';
  END IF;
  IF NEW.cycle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cycles c
    WHERE c.id = NEW.cycle_id AND c.team_id = NEW.team_id AND c.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'cycle does not belong to issue team';
  END IF;
  IF NEW.milestone_id IS NOT NULL THEN
    IF NEW.project_id IS NULL THEN
      RAISE EXCEPTION 'milestone requires project';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM milestones m
      WHERE m.id = NEW.milestone_id AND m.project_id = NEW.project_id AND m.workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'milestone does not belong to project';
    END IF;
  END IF;
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'project not in workspace';
  END IF;
  RETURN NEW;
END;
$issue$ LANGUAGE plpgsql;

CREATE TRIGGER issues_invariants
  BEFORE INSERT OR UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION enforce_issue_invariants();

-- Indexes
CREATE INDEX issues_workspace_updated_idx ON issues (workspace_id, updated_at DESC);
CREATE INDEX issues_team_status_sort_idx ON issues (team_id, state_id, sort_order);
CREATE INDEX issues_assignee_idx ON issues (workspace_id, assignee_id);
CREATE INDEX issues_project_idx ON issues (project_id);
CREATE INDEX issues_cycle_idx ON issues (cycle_id);
CREATE INDEX issues_parent_idx ON issues (parent_id);
CREATE INDEX issues_due_idx ON issues (workspace_id, due_at);
CREATE INDEX issue_labels_label_idx ON issue_labels (workspace_id, label_id);
CREATE INDEX issues_active_updated_idx ON issues (workspace_id, updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX issues_active_team_idx ON issues (team_id, state_id, sort_order) WHERE archived_at IS NULL;
CREATE INDEX issues_search_identifier_idx ON issues (workspace_id, identifier);
CREATE INDEX issues_search_title_idx ON issues (workspace_id, lower(title));
CREATE INDEX workspace_changes_workspace_seq_idx ON workspace_changes (workspace_id, sequence);
CREATE INDEX outbox_unprocessed_idx ON outbox_events (workspace_id, created_at) WHERE processed_at IS NULL;
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX comments_issue_idx ON comments (issue_id, created_at);
CREATE INDEX activity_issue_idx ON activity_events (issue_id, created_at DESC);
