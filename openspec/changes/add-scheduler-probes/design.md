# Design

## Context

Day 2 stored targets with `next_check_at` and never claimed them. `apps/worker` is a heartbeat stub; `apps/worker/src/probe/` is reserved; ESLint already forbids outbound HTTP outside that folder. See proposal.md for motivation. Normative pipeline: `docs/architecture/transactionality.md` (two short transactions) and `docs/architecture/external-integrations.md` (Appendix C). Incident transitions (`applyCheckResult`) are Day 4 and MUST NOT be implemented here.

## Goals / Non-Goals

**Goals:**

- Composition-root worker that migrates, polls due rows, probes, and inserts checks.
- A testable `ProbeClient` port (production undici adapter + test fake).
- Hermetic tests: Postgres SKIP LOCKED, mock-target timeout, semaphore unit tests. No third-party hosts.

**Non-Goals:**

- Opening or resolving incidents; consecutive grace/recovery counters.
- Redis cache writes after commit.
- `POST /targets/:id/check-now`, dashboard check history, public status JSON.

## Decisions

### 1. Two transactions: claim+lease then persist (architecture)

tx1: `SELECT … WHERE enabled AND next_check_at <= now() ORDER BY next_check_at FOR UPDATE SKIP LOCKED LIMIT $n` then `UPDATE next_check_at = now + interval + jitter`. Commit before any HTTP.

tx2: `SELECT … FROM targets WHERE id = $1 FOR UPDATE`, `INSERT INTO checks`, `UPDATE last_checked_at` and `last_status` (`up`/`down` from this check only). No incident rows, no consecutive-counter machine.

Rejected: holding the claim lock across the probe (blocks API edits, burns pool connections). Advancing `next_check_at` in tx1 is the lease; a crashed worker lets the row become due again at the next interval.

### 2. Claim batch ≤ available global permits

`PROBE_MAX_CONCURRENCY` default 20, `PROBE_MAX_PER_HOST` default 2. Semaphores in the worker (not Redis). Acquire global permits, claim at most that many rows, acquire per-host, probe, release host then global. Idle poll sleep when no due work or no permits. The poll is a loop with injected `sleep`; `setInterval` is not the scheduler of record.

### 3. Probe client: undici `Agent` in `apps/worker/src/probe/`

Dedicated Agent (own pool, no global dispatcher). `AbortSignal.timeout(timeout_ms)` for the total deadline. Connect timeout `min(2000, timeout_ms)` on the Agent. `maxRedirections: 0`; follow ≤ 3 Location hops manually and re-run SSRF on each. Read ≤ 4096 bytes then destroy the stream. Always set `User-Agent: beacon-watch/1.0` last. No cookie jar. Latency = `performance.now()` from start to headers.

TLS: `rejectUnauthorized: true` unless `PROBE_INSECURE_TLS=true` and `NODE_ENV` is not `production`.

### 4. SSRF at probe time with DNS pinning

When `SSRF_PROTECTION=true`, resolve once (`dns.lookup` all addresses), reject any blocked IP via existing `isBlockedIp` / `isBlockedHostname`, then connect through a custom lookup that returns only validated addresses. Compose sets `SSRF_PROTECTION=false` on the worker only so `http://mock-target:8080` works; the API stays protected with `SSRF_ALLOWLIST=mock-target`.

### 5. Probe results are data

Return `{ success, statusCode, latencyMs, errorCode, errorMessage }` — never throw for TIMEOUT/DNS/TLS/CONNECT/UNEXPECTED_STATUS/SSRF_BLOCKED/REDIRECT_LIMIT. Unexpected throws become `INTERNAL`. No retries inside a check. `error_message` truncated to 500 chars in the repository. Probe error codes live in `packages/domain` as a closed set separate from API `ERROR_CODES`.

### 6. Domain jitter is pure

`computeNextCheckAt(now, intervalSeconds, random)` in `packages/domain`. `random()` returns `[0, 1)`. Tests inject a fixed `random`.

### 7. mock-target fixtures

Add `/slow?ms=`, `/status/:code`, `/redirect/:n`, `/large` next to `/health`. Worker tests start that server on an ephemeral port (or equivalent in-process listener). CI keeps the Postgres service; tests do not contact the public internet.

### 8. Worker config

Zod `config.ts` gains required `DATABASE_URL`, existing probe/SSRF keys, `PROBE_INSECURE_TLS` default false, `SCHEDULER_POLL_MS` default 1000. Invalid production `PROBE_INSECURE_TLS=true` is a config error. Worker migrates at boot (idempotent with the API).

### 9. Persistence

Forward-only `0002_checks.sql`: table `checks` with FK `ON DELETE CASCADE`, index `(target_id, checked_at DESC)`. Repository `packages/db/src/repositories/checks.ts` plus `claimDueTargets` on the targets repository. Claim SQL stays in the targets repo (it locks `targets` rows).

## Risks / Trade-offs

- [Last_status without grace] → Day 3 maps this check to `up`/`down` immediately. Day 4 will add thresholds and may stop treating a single failure as `down`. Documented as non-goal of this change.
- [Leased but crashed] → next interval is the retry; no in-flight reclaim. Acceptable for MVP.
- [SSRF off in Compose] → required for Docker DNS; production profiles keep it true. README calls this out.
- [Slow `/slow` in mock-target] → tests use `timeout_ms` 500 and delay 2000 so the deadline is the probe, not the suite.

## Migration Plan

1. Ship `0002_checks.sql`. API and worker both run `migrate()` at boot; empty volumes apply 0001 then 0002.
2. Rollback: no down migration. A follow-up forward file can drop the table if needed before production data exists.

## Open Questions

None.
