CREATE TABLE IF NOT EXISTS external_identities (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id text REFERENCES integration_installations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_user_id text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at bigint NOT NULL,
  UNIQUE (workspace_id, provider, external_user_id)
);

CREATE TABLE IF NOT EXISTS inbound_receipts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id text REFERENCES integration_installations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  delivery_id text NOT NULL,
  timestamp_ms bigint NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE (workspace_id, delivery_id)
);

CREATE TABLE IF NOT EXISTS external_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id text REFERENCES integration_installations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  issue_id text REFERENCES issues(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at bigint,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_commands (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id text REFERENCES external_events(id) ON DELETE CASCADE,
  command_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS inbound_receipts_delivery_idx
  ON inbound_receipts (workspace_id, delivery_id);
CREATE INDEX IF NOT EXISTS external_links_issue_idx
  ON external_links (issue_id);
CREATE INDEX IF NOT EXISTS external_events_workspace_idx
  ON external_events (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx
  ON webhook_deliveries (subscription_id, created_at);
