-- Explicit probe lease (owner token + expiry) and a coalesced manual-check signal.
-- next_check_at remains the idle due time only; it is not the in-flight lock.

ALTER TABLE targets
  ADD COLUMN probe_lease_token uuid,
  ADD COLUMN probe_lease_expires_at timestamptz,
  ADD COLUMN manual_check_requested boolean NOT NULL DEFAULT false;

CREATE INDEX targets_probe_lease_expires_at_idx
  ON targets (probe_lease_expires_at)
  WHERE probe_lease_expires_at IS NOT NULL;
