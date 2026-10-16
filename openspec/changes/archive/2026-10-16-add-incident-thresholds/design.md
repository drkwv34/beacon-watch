# Design

## Context

Day 3 claims due targets, probes outside the transaction, then inserts a `checks` row and sets `last_status` from that single outcome. `targets` already stores `grace_threshold`, `recovery_threshold`, `consecutive_failures`, and `consecutive_successes` (all default 0 / 2). There is no `incidents` table and the worker persist path does not call a state machine. See proposal.md for motivation. Normative pipeline: `docs/architecture/transactionality.md` (tx2 after probe) and `docs/architecture/domain-modeling.md` (Appendix B machine).

## Goals / Non-Goals

**Goals:**

- Pure `applyCheckResult` in `packages/domain/src/incidents/` matching the architecture type shape.
- Forward-only `incidents` table + repository; counters updated on the existing `targets` row.
- Worker tx2: lock target, insert check, apply machine, update counters/`last_status`, open or resolve.
- Owner-scoped timeline GET with duration.

**Non-Goals:**

- Notifications, Redis, public JSON, dashboard UI, retention cleanup jobs.
- Changing claim/lease (tx1) or the probe client.

## Decisions

### 1. Machine is pure and total (architecture)

```ts
type Counters = { consecutiveFailures: number; consecutiveSuccesses: number; hasOpenIncident: boolean };
type Thresholds = { grace: number; recovery: number };
type Transition = { counters: Counters; action: 'open' | 'resolve' | 'none' };
function applyCheckResult(prev: Counters, success: boolean, t: Thresholds): Transition;
```

On success: failures = 0, successes += 1; if open and successes ≥ recovery then `resolve` and `hasOpenIncident=false`. On failure: successes = 0, failures += 1; if not open and failures ≥ grace then `open` and `hasOpenIncident=true`. Otherwise `none`. Rejected: encoding `hasOpenIncident` only in `last_status` (fragile) or putting SQL in domain.

### 2. `hasOpenIncident` comes from the locked row's open incident

tx2 `SELECT targets … FOR UPDATE`, then `SELECT incidents … WHERE target_id = $1 AND status = 'open'`. Pass that boolean into the machine so two workers serialize on the target lock. The partial unique index `incidents (target_id) WHERE status = 'open'` is the final guard; unique violation → already open, no-op.

### 3. Same transaction as the check

tx2 after the probe (no HTTP held): insert check → machine → update counters and `last_status` → insert or resolve incident. One `withTransaction`. Rejected: applying incidents in a third transaction (could commit a check without the open that the check tripped).

### 4. `last_status` follows the incident

After the transition: `down` if `hasOpenIncident`; else `up` if this check succeeded (including resolve); else keep the previous `last_status` (isolated failure under grace). Rejected: keeping Day 3's immediate up/down (violates NFR-REL-002).

### 5. Schema

`0003_incidents.sql`: `incidents` with `id`, `target_id` FK `ON DELETE CASCADE`, `status` in (`open`,`resolved`), `opened_at`, `resolved_at`, `trigger_check_id` FK to `checks`, `resolve_check_id` FK to `checks`. Check: resolved_at set iff status is resolved. Partial unique open index. Index `(target_id, opened_at DESC)` for the timeline. Counters stay on `targets` (already migrated). `IncidentId` branded in domain.

### 6. Timeline is 404 for non-owners

Authenticated `GET /api/v1/targets/:id/incidents` under the existing session+CSRF plugin. Missing id and other-owner both `NOT_FOUND` (brief FR-INC-003). This differs from `GET /targets/:id` which still returns 403 for another user (FR-ERR-003). Duration is integer seconds. Inject `now` in the service. Response `{ items: [...] }` newest first. Unauthenticated still 401 via the existing gate; tests for that gate stay on `/api/v1/__probe`.

### 7. Tests

Unit: replay Appendix B row by row plus grace=3. Integration: real Postgres sequence fail,success → none; fail,fail → one open; success,success → resolved; two concurrent persist workers → one open. API inject: open+resolved with duration; 404 non-owner.

## Risks / Trade-offs

- [Unique-index vs lock] → FOR UPDATE is the primary serializer; unique violation is defensive. Tests hit both concurrent persist and the flaky sequence.
- [403 vs 404 on timeline] → brief requires 404 for non-owner on this route; target CRUD stays 403. Documented in the spec so it is not "fixed" later as inconsistency.
- [Day 3 last_status tests] → existing scheduler tests do not assert last_status from a single failure; extend rather than change those contracts.

## Migration Plan

1. Ship `0003_incidents.sql`. API and worker both run `migrate()` at boot; empty volumes apply 0001–0003.
2. Rollback: no down migration. A follow-up forward file can drop the table if needed before production data exists.

## Open Questions

None.
