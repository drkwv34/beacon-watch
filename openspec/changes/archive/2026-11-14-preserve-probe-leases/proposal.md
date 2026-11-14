# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-14 |
| Capabilities | scheduling, targets |
| FR / NFR IDs | FR-SCH-001, FR-SCH-005, FR-UI-004, NFR-PERF-002 |

## Why

`next_check_at` is both the idle schedule and the in-flight lease. `POST /targets/:id/check-now` writes `next_check_at = now()` even while a worker holds the row, so a second worker can `SKIP LOCKED` claim the same target and probe it twice. Finalization does not own a token, so a late persist can clobber another worker. The route also returns 200 instead of accepting the work as 202.

## What Changes

- Add a forward-only migration for an explicit probe lease (`owner token` + `expires_at`) and a coalesced `manual_check_requested` signal. Do not infer in-flight from a future `next_check_at`.
- Claim with `FOR UPDATE SKIP LOCKED` excludes rows whose lease is still active. Idle check-now advances due; check-now during an in-flight lease is coalesced into that probe (no duplicate). Paused targets are never reactivated and never probed.
- Token-guarded finalization schedules `interval + jitter(0–10%)` from completion, releases the lease, and MUST NOT overwrite another worker's token. Expired leases are reclaimable (crash recovery); a stale owner cannot finalize a newer lease.
- Lease expiry and renewal cover per-host semaphore wait plus `timeout_ms`.
- `POST /api/v1/targets/:id/check-now` returns **BREAKING** 202 with the existing target JSON envelope. 401 unauthenticated, 403 non-owner, and 403 CSRF are unchanged. The API still never probes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `scheduling`: claim uses an explicit lease token and expiry, not `next_check_at` as the lock; SKIP LOCKED skips active leases; check-now during a lease coalesces; completion reschedules from the finish clock; expired leases recover; paused rows stay unclaimed.
- `targets`: owner check-now returns 202, advances due only when idle and enabled, coalesces when a lease is held, and never re-enables a paused target.

## Impact

- Code: `packages/db` migration + target repository, `packages/domain` lease/schedule helpers, `apps/worker` claim/renew/finalize, `apps/api` check-now status and coalescing.
- APIs: `POST /api/v1/targets/:id/check-now` status 202 (was 200); body still the public target envelope. Authz status codes unchanged.
- Schema: `targets.probe_lease_token`, `targets.probe_lease_expires_at`, `targets.manual_check_requested`.
- Config: none new; existing `PROBE_MAX_CONCURRENCY` / `PROBE_MAX_PER_HOST` / `timeout_ms` bound lease lifetime.
- Conventions: `docs/architecture/transactionality.md`, README scheduling hard edge, `.cursor/rules/worker-probe.mdc`.
- Out of scope: other findings; API outbound probes; Redis as a lease store; changing per-host/global semaphore defaults.
