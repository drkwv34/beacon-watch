# Design

## Context

See proposal.md for motivation. Today `claimDueTargets` advances `next_check_at` as the lease, `TargetService.checkNow` writes `next_check_at = now()` without regard to an in-flight claim, `updateTargetAfterCheck` never releases a separate lease, and the route returns 200. Claim still happens before the per-host semaphore wait (`run-check.ts`). Probes stay outside any transaction (`docs/architecture/transactionality.md`). Postgres remains the source of truth; Redis is not used for leases.

## Goals / Non-Goals

**Goals:**

- One probe per target for a given due/manual cycle, including two workers, host max 2, and check-now during claim/queue/probe.
- Crash recovery by expiry; stale owner cannot drop a newer lease.
- 202 on accepted check-now with the existing public target JSON.

**Non-Goals:**

- Moving claim to after the semaphore (would change batching more than needed).
- Redis locks, a job queue, or API-side probing.
- New env vars unless a lease grace cannot be derived from `timeout_ms`.

## Decisions

### 1. Explicit lease columns, not a future `next_check_at`

Forward-only `packages/db/migrations/0004_target_probe_leases.sql`:

- `probe_lease_token uuid NULL`
- `probe_lease_expires_at timestamptz NULL`
- `manual_check_requested boolean NOT NULL DEFAULT false`

Partial index on `probe_lease_expires_at` where not null. Keep `targets_next_check_at_enabled_idx`. `next_check_at` remains the idle due time only.

Rejected: keep encoding the lease in `next_check_at` (check-now cannot tell idle-future from in-flight). Rejected: a side table (extra join for every claim).

### 2. Atomic SKIP LOCKED claim

In one short transaction:

```
SELECT … FROM targets
 WHERE enabled
   AND (probe_lease_expires_at IS NULL OR probe_lease_expires_at <= $now)
   AND (next_check_at <= $now OR manual_check_requested)
 ORDER BY next_check_at ASC, id ASC
 FOR UPDATE SKIP LOCKED
 LIMIT $n;

UPDATE … SET probe_lease_token = gen_random_uuid(),
             probe_lease_expires_at = $expiry,
             manual_check_requested = false
```

`$expiry = now + timeout_ms + grace`, where grace is at least `3 * timeout_ms` (covers per-host queue of several timeouts) and at least 30s. Domain helper `computeProbeLeaseExpiry(now, timeoutMs)` is pure. Claim does not rewrite `next_check_at`.

While waiting on the per-host semaphore and before the probe, the worker renews the same token (`UPDATE … WHERE id AND probe_lease_token`). Renewal failure means the lease expired and another worker owns it: drop the work without probing.

Rejected: claim only after `perHost.acquire` (starves the global permit accounting already in `tick`). Rejected: a huge fixed TTL with no renewal (either too short under host=2 queues or too slow to recover).

### 3. Token-guarded persist + finalize in one transaction

`persistCheck` takes the owner token. After `lockTargetForUpdate`, if `probe_lease_token` does not match, return without inserting a check or touching schedule. On match: insert check, apply incident machine, then set counters, `probe_lease_token = NULL`, `probe_lease_expires_at = NULL`, `next_check_at = computeNextCheckAt(completion, interval, random)`.

Rejected: two transactions (persist then release) — a crash between them leaves a completed check leased until expiry and can double-probe. Rejected: finalize that matches only on `id` — a stale worker would clobber the new lease.

### 4. Check-now is a schedule signal, status 202

One transaction, `FOR UPDATE` on the target (ownership already checked):

- Paused (`enabled = false`): no column changes; return the public envelope.
- Active lease (`token` set and `expires_at > now`): no column changes (coalesced into that probe).
- Idle enabled: `next_check_at = now`, `manual_check_requested = true`.

Route: `reply.status(202).send(envelope)`. CSRF/session hooks stay as they are (401/403). UI already treats 2xx as queued.

Rejected: setting `manual_check_requested` during an active lease (would schedule a duplicate after finalize). Rejected: 200 with an `accepted` flag (contract called for 202).

### 5. Tests first, barriers not sleeps

Red on current main:

- Two workers, six ~4s probes, host max 2, global permits ≥ 6. Latch when the first wave of probes starts; apply check-now (today: `setNextCheckAt(now)`); start the second worker; release the latch. Assert one probe/check per target. Today the first ids duplicate.
- Owner+CSRF check-now expects 202; today 200.

Then lease-expiry reclaim, stale-token no-op, idle advances due, paused stays dark. No `setTimeout` as the synchronizer.

## Risks / Trade-offs

- [Queued claims expire before the probe] → initial grace plus renewal until acquire and again before `probe()`.
- [check-now during in-flight looks like a no-op in `next_check_at`] → 202 still confirms acceptance; the in-flight check is the fulfillment.
- [Paused check-now used to write `next_check_at = now`] → enabling later would have been immediately due; new behavior leaves the paused schedule untouched.
- [202 is **BREAKING** for clients that require 200] → dashboard uses `res.ok`; document in README.

## Migration Plan

1. Apply `0004_target_probe_leases.sql` (nullable token/expiry; existing rows are idle).
2. Deploy API and worker together: old workers would ignore new columns and still race on `next_check_at`; do not mix.
3. Rollback: restore previous binaries; leftover lease columns are unused. Do not edit 0004; a later migration would drop columns if ever required.

## Open Questions

None.
