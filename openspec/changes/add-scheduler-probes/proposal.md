# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-15 |
| Capabilities | scheduling, probe |
| FR / NFR IDs | FR-SCH-001, FR-SCH-002, FR-SCH-003, FR-SCH-004, FR-SCH-005, FR-ERR-002, NFR-SEC-001 (probe-time SSRF), NFR-PERF-002, Appendix C |

## Why

Day 2 left targets sitting in Postgres with `next_check_at` and never contacted them. Without a due-claim scheduler and an isolated probe client there is no check history, no latency, and no way to prove two workers will not double-check the same row. This change is the first runtime loop: claim, probe, persist.

## What Changes

- Worker due claim (FR-SCH-001): select enabled targets where `next_check_at <= now()` with `FOR UPDATE SKIP LOCKED`, lease by advancing `next_check_at = now + interval_seconds` plus 0–10% jitter, probe **outside** the transaction, then persist the result in a second short transaction.
- Isolated HTTP probe client in `apps/worker/src/probe/` only (FR-SCH-002, Appendix C): dedicated undici `Agent`, total timeout = `target.timeout_ms`, connect timeout ≤ min(2000, timeout_ms), max 3 redirects with SSRF re-check per hop, 4 KiB body cap then abort, `User-Agent: beacon-watch/1.0`, no cookie jar, TLS verify on by default.
- Success is TCP/TLS ok **and** HTTP status == `expected_status`; every other outcome is a failed check with a stable probe error code (FR-SCH-003, FR-ERR-002).
- Persist each check (FR-SCH-004): `target_id`, `checked_at`, `success`, `status_code`, `latency_ms`, `error_code`, `error_message` truncated to 500 chars. Forward-only `checks` table with `ON DELETE CASCADE` and index `(target_id, checked_at DESC)`.
- Global max concurrent probes default 20 and per-host max 2 (FR-SCH-005, NFR-PERF-002); excess due targets wait. Claim batch size ≤ available global permits.
- mock-target gains a slow endpoint so a timeout fails the check without stalling the pool. Compose keeps `SSRF_PROTECTION=false` on the worker so `http://mock-target:8080` works (Appendix C #6).
- No **BREAKING** changes: this is additive (new worker loop and table).

Out of scope (later days): incident state machine and grace/recovery (Day 4, FR-INC-*), Redis cache writes and public API rate limit (Day 5), dashboard/status-page UI, PagerDuty/Slack, `POST /targets/:id/check-now`.

## Capabilities

### New Capabilities

- `scheduling`: Due-target claiming with `SKIP LOCKED` leases, jittered `next_check_at`, check success mapping, check persistence, and the global/per-host probe pool.
- `probe`: The only outbound HTTP client, Appendix C limits, probe-time SSRF with DNS pinning, and probe failures returned as data.

### Modified Capabilities

- None. Existing `auth` and `targets` requirements do not change; the worker reads target rows that Day 2 already stores.

## Impact

- Code: `apps/worker` (scheduler, probe client, semaphores), `packages/domain` (jitter, probe error codes), `packages/db` (checks migration and repository), `mock-target` (slow/status/redirect fixtures).
- APIs: none. The dashboard is unchanged this night.
- Dependencies: `undici` in the worker; `@beacon-watch/db` in the worker.
- Schema: new table `checks`.
- Config: worker `DATABASE_URL`, existing `PROBE_MAX_*` and `SSRF_PROTECTION`; optional `PROBE_INSECURE_TLS` (rejected in production).
- Conventions: already written in `docs/architecture/external-integrations.md` and `transactionality.md`; README notes Compose `SSRF_PROTECTION=false` on the worker.
- CI: existing Postgres service plus in-process/spawned mock-target for probe tests; two-worker SKIP LOCKED integration test.
