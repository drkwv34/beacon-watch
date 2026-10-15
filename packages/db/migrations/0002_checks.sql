-- Probe results (Day 3). Incidents land later and will also FK to targets.

CREATE TABLE checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL,
  success boolean NOT NULL,
  status_code integer,
  latency_ms integer,
  error_code text,
  error_message text,
  CONSTRAINT checks_status_code_chk CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  CONSTRAINT checks_latency_chk CHECK (latency_ms IS NULL OR latency_ms >= 0),
  CONSTRAINT checks_error_message_len_chk CHECK (error_message IS NULL OR char_length(error_message) <= 500)
);

CREATE INDEX checks_target_id_checked_at_idx ON checks (target_id, checked_at DESC);
