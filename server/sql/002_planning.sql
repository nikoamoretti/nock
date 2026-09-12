CREATE TABLE IF NOT EXISTS project_relations (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  related_project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('blocks')),
  PRIMARY KEY (project_id, related_project_id, kind),
  CHECK (project_id <> related_project_id)
);

CREATE INDEX IF NOT EXISTS project_relations_related_idx
  ON project_relations (related_project_id);
