# Transactionality and concurrency

## Boundaries

- **One use case = at most one database transaction**, opened in the service layer via `withTransaction(pool, fn)`.
  Repositories accept the `tx` handle and never open their own transactions.
- **No network IO inside a transaction.** Probes, Redis calls, and HTTP requests happen before or after, never while holding row locks.
- Default isolation is `READ COMMITTED`. Correctness comes from row locks and constraints, not from `SERIALIZABLE`.

## The check pipeline (FR-SCH-001, FR-INC-*)

```
tx1 (short): claim due targets
  SELECT … FROM targets
   WHERE enabled
     AND (probe_lease_expires_at IS NULL OR probe_lease_expires_at <= now())
     AND (next_check_at <= now() OR manual_check_requested)
   ORDER BY next_check_at FOR UPDATE SKIP LOCKED LIMIT $batch;
  UPDATE targets SET probe_lease_token, probe_lease_expires_at,  -- explicit lease
                     manual_check_requested = false
COMMIT

probe (no transaction held)
  after per-host acquire: renew the same token (drop the work if the token no longer matches)

tx2 (short): record result
  SELECT … FROM targets WHERE id = $1 FOR UPDATE;           -- serialize counter updates per target
  -- if probe_lease_token ≠ owner token: no-op (stale worker)
  INSERT INTO checks …;
  domain.applyCheckResult(counters, success, thresholds)     -- pure
  UPDATE targets SET counters, last_status, last_checked_at,
                     probe_lease_token = NULL, probe_lease_expires_at = NULL,
                     next_check_at = completion + interval + jitter
   WHERE probe_lease_token = owner token;
  INSERT/UPDATE incidents (if action = open | resolve);
COMMIT

after commit: write Redis cache, invalidate status page (best effort)
```

Why two transactions: holding a lock across a 10s probe would block the API from editing the target and waste pool connections.
The lease is `probe_lease_token` + `probe_lease_expires_at`, not a future `next_check_at`. A crashed worker is reclaimed when the expiry passes; a stale persist cannot clear a newer token. Lease expiry is `timeout_ms` plus grace covering per-host semaphore wait.

## Idempotency and constraints

- The partial unique index `incidents(target_id) WHERE status = 'open'` is the final guard against duplicate open incidents.
  A unique violation there is treated as "already open" (no-op), not an error.
- `public_slug` uniqueness is a DB constraint; map `23505` on that index to `CONFLICT`.
- `POST /targets/:id/check-now` returns 202. Idle enabled targets set `next_check_at = now()` and `manual_check_requested`; an in-flight lease is left unchanged (the current probe satisfies the request); paused targets are not re-enabled.
- Cache writes happen **after commit** only. A failed cache write logs `warn` and never rolls back persisted data.

## Concurrency limits (FR-SCH-005)

- Global probe semaphore (`PROBE_MAX_CONCURRENCY`, default 20) and per-host semaphore (`PROBE_MAX_PER_HOST`, default 2).
- Claim batch size ≤ available global permits, so claimed rows do not sit leased while waiting.
- Multiple worker processes are safe by construction (`SKIP LOCKED`); integration tests run two workers against one DB.
