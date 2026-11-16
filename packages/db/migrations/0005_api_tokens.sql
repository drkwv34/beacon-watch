-- Opaque hashed management API tokens (FR-AUTH-003).
-- The raw secret is never stored; token_hash is HMAC with a domain-separated context.

CREATE TABLE api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  prefix text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  CONSTRAINT api_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT api_tokens_label_len_chk CHECK (char_length(label) BETWEEN 1 AND 100),
  CONSTRAINT api_tokens_prefix_len_chk CHECK (char_length(prefix) BETWEEN 1 AND 32)
);

CREATE INDEX api_tokens_user_id_idx ON api_tokens (user_id);
CREATE INDEX api_tokens_user_active_idx ON api_tokens (user_id) WHERE revoked_at IS NULL;
