-- Users, server-side sessions, and HTTP monitor targets (Day 2).
-- Child tables (checks, incidents) land later and will FK ON DELETE CASCADE to targets.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_lower text GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower_key UNIQUE (email_lower)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  interval_seconds integer NOT NULL DEFAULT 60,
  timeout_ms integer NOT NULL DEFAULT 5000,
  expected_status integer NOT NULL DEFAULT 200,
  headers jsonb,
  body text,
  grace_threshold integer NOT NULL DEFAULT 2,
  recovery_threshold integer NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  public_slug text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  consecutive_successes integer NOT NULL DEFAULT 0,
  last_status text NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT targets_method_chk CHECK (method IN ('GET', 'HEAD', 'POST')),
  CONSTRAINT targets_interval_chk CHECK (interval_seconds BETWEEN 30 AND 3600),
  CONSTRAINT targets_timeout_chk CHECK (timeout_ms BETWEEN 500 AND 10000),
  CONSTRAINT targets_status_chk CHECK (expected_status BETWEEN 100 AND 599),
  CONSTRAINT targets_grace_chk CHECK (grace_threshold BETWEEN 1 AND 10),
  CONSTRAINT targets_recovery_chk CHECK (recovery_threshold BETWEEN 1 AND 10),
  CONSTRAINT targets_last_status_chk CHECK (last_status IN ('up', 'down', 'unknown')),
  CONSTRAINT targets_body_len_chk CHECK (body IS NULL OR char_length(body) <= 8192)
);

CREATE INDEX targets_user_id_idx ON targets (user_id);
CREATE INDEX targets_next_check_at_enabled_idx ON targets (next_check_at) WHERE enabled;
CREATE UNIQUE INDEX targets_public_slug_idx ON targets (public_slug) WHERE public_slug IS NOT NULL;
