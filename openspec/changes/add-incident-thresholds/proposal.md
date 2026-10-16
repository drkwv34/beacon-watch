# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-15 |
| Capabilities | incidents |
| FR / NFR IDs | FR-INC-001, FR-INC-002, FR-INC-003, FR-INC-004, NFR-REL-002, SRS Appendix B |

## Why

Day 3 persists every probe as a check and maps `last_status` from that single result. One isolated failure would open noise and a single success would clear it. Owners need grace and recovery thresholds so flaky targets open and resolve incidents only after consecutive outcomes, with a timeline they can read.

## What Changes

- Pure incident state machine in `packages/domain` (Appendix B): input is counters (`consecutive_failures`, `consecutive_successes`), whether an incident is open, `grace_threshold`, `recovery_threshold`, and the check outcome; output is new counters plus action `none` | `open` | `resolve`. Counters reset on the opposite outcome. Defaults for grace and recovery are 2.
- Open incident (FR-INC-001): when consecutive failures ≥ `grace_threshold` and no incident is open, insert `status=open` with `opened_at` and `trigger_check_id` (the check that tripped it).
- Resolve incident (FR-INC-002): when consecutive successes ≥ `recovery_threshold` and an incident is open, set `resolved_at`, `resolve_check_id`, and `status=resolved`. Never reopen the same row; a later failure streak opens a new incident.
- Persistence: forward-only `incidents` table with at most one open incident per target (partial unique index). Apply the transition in the worker in the same transaction that inserts the check (FR-INC-004 / NFR-REL-002), after locking the target row. A unique violation on the open-incident index is a no-op.
- `last_status` follows the incident, not a single check: isolated failures under grace do not mark the target `down`; an open incident is `down`; resolve (or success with no open incident) is `up`.
- Timeline API (FR-INC-003): `GET /api/v1/targets/:id/incidents` (session auth) returns incidents newest first with `status`, `opened_at`, `resolved_at`, `trigger_check_id`, and `duration_seconds` (open: now − `opened_at`; resolved: `resolved_at` − `opened_at`). Missing or other-owner targets return 404.
- No **BREAKING** changes: additive table, worker persist path, and one GET.

Out of scope (later days): PagerDuty/Slack/email notifications; multi-region; Redis cache and public API rate limit (Day 5); dashboard or status-page UI (Day 6). No Playwright screenshot this night.

## Capabilities

### New Capabilities

- `incidents`: Appendix B grace/recovery state machine, open/resolve persistence with one-open-per-target, same-transaction application with the check, consecutive counters, last_status smoothing, and the owner-scoped incident timeline.

### Modified Capabilities

- None. Existing `auth`, `targets`, `scheduling`, and `probe` requirements stay as shipped; this change consumes the check persist transaction they already own.

## Impact

- Code: `packages/domain` (pure machine), `packages/db` (incidents migration and repository; target counter updates), `apps/worker` (apply transition in the check persist transaction), `apps/api` (timeline route).
- APIs: `GET /api/v1/targets/:id/incidents`.
- Dependencies: none new.
- Schema: new table `incidents`; counters already exist on `targets`.
- Conventions: already written in `docs/architecture/domain-modeling.md`, `transactionality.md`, and `persistence.md`.
- CI: existing Postgres service; unit tests replay Appendix B; integration tests the flaky sequence and concurrent workers.
