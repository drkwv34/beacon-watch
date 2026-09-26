# Domain modeling

## Aggregates and invariants

| Aggregate | Root fields (SRS §6) | Invariants the code must hold |
| --- | --- | --- |
| **User** | id, email, password_hash | Email unique case-insensitively. |
| **Target** | url, method, interval_seconds, timeout_ms, expected_status, thresholds, enabled, is_public, public_slug, counters, next_check_at, last_status | `interval_seconds ∈ [30, 3600]`; `timeout_ms ∈ [500, 10000]`; `method ∈ {GET, HEAD, POST}`; body only for POST and ≤ 8 KiB; headers size-limited; `public_slug` unique when set; ≤ 50 targets per user; only the owner mutates. |
| **Check** | target_id, checked_at, success, status_code, latency_ms, error_code, error_message | Append-only. `error_message` truncated to 500 chars. Never updated after insert. |
| **Incident** | target_id, status, opened_at, resolved_at, trigger_check_id, resolve_check_id | At most one `open` incident per target (partial unique index). `resolved_at` set iff `status = resolved`. Never reopened; a new failure streak opens a new incident. |

`Check` and `Incident` are separate aggregates referencing `Target` by id. The target's counters
(`consecutive_failures`, `consecutive_successes`) and `last_status` change in the **same transaction** as the check insert
and any incident transition.

## The incident machine (normative: SRS Appendix B)

Lives in `packages/domain/src/incidents/`, implemented Day 4. Shape:

```ts
type Counters = { consecutiveFailures: number; consecutiveSuccesses: number; hasOpenIncident: boolean };
type Thresholds = { grace: number; recovery: number };
type Transition = { counters: Counters; action: 'open' | 'resolve' | 'none' };

function applyCheckResult(prev: Counters, success: boolean, t: Thresholds): Transition;
```

Pure, total, and exhaustively unit-tested against the worked example in Appendix B.

## Modeling rules

- **Types from the domain, not the database.** DB rows map to domain types at the repository boundary (`snake_case` → `camelCase`).
- **Closed sets are `as const` tuples + derived unions** (see `TARGET_STATUSES`), with a type guard for untrusted input.
- **`paused` is derived**, not stored: `enabled = false` → display `paused`. Persisted `last_status` is only `up | down | unknown`.
- **Branded IDs** (`TargetId`, `UserId`) once repositories exist, to prevent mixing IDs across aggregates.
- **Time is injected.** Domain functions take `now: Date` (or epoch ms). Jitter takes an injected `random()` so tests are deterministic.
- **Validation lives twice on purpose:** Zod at the transport edge for shape, domain functions for business rules (ranges, limits). Both return `VALIDATION_FAILED` with field-level details.
