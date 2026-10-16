-- Open/resolved incident timeline (Day 4). At most one open row per target.

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
  status text NOT NULL,
  opened_at timestamptz NOT NULL,
  resolved_at timestamptz,
  trigger_check_id uuid NOT NULL REFERENCES checks (id),
  resolve_check_id uuid REFERENCES checks (id),
  CONSTRAINT incidents_status_chk CHECK (status IN ('open', 'resolved')),
  CONSTRAINT incidents_resolved_chk CHECK (
    (status = 'open' AND resolved_at IS NULL AND resolve_check_id IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX incidents_one_open_per_target_idx ON incidents (target_id) WHERE status = 'open';
CREATE INDEX incidents_target_id_opened_at_idx ON incidents (target_id, opened_at DESC);
