# incidents Specification

## Purpose
Opens and resolves per-target incidents with grace and recovery thresholds so isolated failures stay quiet, and exposes an owner-scoped incident timeline.

## Requirements

### Requirement: FR-INC-001 Open after grace
The system SHALL open an incident when consecutive failures reach the target's `grace_threshold` and no incident is already open. The new row MUST have `status=open`, `opened_at`, and `trigger_check_id` of the check that tripped the threshold. Default `grace_threshold` is 2.

#### Scenario: Two consecutive failures open one incident
- **WHEN** a target with grace 2 and no open incident records two consecutive failed checks
- **THEN** exactly one incident exists with status open and `trigger_check_id` equal to the second check

#### Scenario: Isolated failure does not open
- **WHEN** a target with grace 2 and no open incident records fail then success
- **THEN** no incident row exists

#### Scenario: Custom grace 3
- **WHEN** a target with grace 3 and no open incident records two consecutive failures
- **THEN** no incident is open
- **WHEN** a third consecutive failure is recorded
- **THEN** exactly one open incident exists

### Requirement: FR-INC-002 Resolve after recovery
The system SHALL resolve the open incident when consecutive successes reach the target's `recovery_threshold`. The row MUST set `resolved_at`, `resolve_check_id`, and `status=resolved`. That row MUST NOT be reopened; a later failure streak opens a new incident. Default `recovery_threshold` is 2.

#### Scenario: Two consecutive successes resolve
- **WHEN** an open incident exists and two consecutive successful checks are recorded
- **THEN** that incident has status resolved and `resolved_at` set, and no open incident remains

#### Scenario: New streak opens a new incident
- **WHEN** a resolved incident exists and consecutive failures again reach grace
- **THEN** a distinct new open incident is created and the resolved row is unchanged

### Requirement: Appendix B Counter machine
The system SHALL apply a total function from current counters, whether an incident is open, the target's thresholds, and the check outcome, producing new counters and action `none`, `open`, or `resolve`. Consecutive counters MUST reset to 0 on the opposite outcome.

#### Scenario: Appendix B worked example grace 2 recovery 2
- **WHEN** starting from zero counters and no open incident, checks arrive as fail, fail, success, fail, success, success
- **THEN** the actions are none, open, none, none, none, resolve

#### Scenario: Success resets failure counter
- **WHEN** consecutive_failures is 1, no incident is open, and the next check succeeds
- **THEN** consecutive_failures is 0, consecutive_successes is 1, and action is none

### Requirement: FR-INC-004 NFR-REL-002 Same-transaction persist
The system SHALL apply the transition in the same database transaction that inserts the check, after locking the target row. At most one open incident per target MUST hold. A unique violation on the open-incident index MUST be treated as already open (no-op), not an error.

#### Scenario: Concurrent workers do not double-open
- **WHEN** two workers persist a failing check for the same target at the same time and grace is reached
- **THEN** exactly one open incident exists for that target

#### Scenario: Check and incident commit together
- **WHEN** a check trips grace
- **THEN** the check row and the open incident row are visible together after commit, never one without the other

### Requirement: FR-INC-003 Incident timeline
`GET /api/v1/targets/:id/incidents` SHALL require a session and return the owner's incidents newest first with `status`, `opened_at`, `resolved_at`, `trigger_check_id`, and `duration_seconds`. Open duration is now minus `opened_at`; resolved duration is `resolved_at` minus `opened_at`. Missing ids and other users' targets MUST return 404.

#### Scenario: Timeline includes open and resolved
- **WHEN** the owner has one open incident and one resolved incident
- **THEN** the response lists both newest first, each with duration_seconds, and the open item has `resolved_at` null

#### Scenario: Non-owner is 404
- **WHEN** an authenticated user requests incidents for a target they do not own
- **THEN** the system returns 404 NOT_FOUND and does not leak the row

#### Scenario: Unknown id is 404
- **WHEN** the owner requests incidents for a well-formed id that does not exist
- **THEN** the system returns 404 NOT_FOUND

### Requirement: NFR-REL-002 last_status follows incidents
The system SHALL NOT set `last_status` to `down` for a failure under grace. `last_status` MUST be `down` while an incident is open and `up` after resolve or after a success with no open incident.

#### Scenario: Isolated failure keeps prior status
- **WHEN** a target with last_status unknown or up records a single failure under grace
- **THEN** last_status is not down and no incident is open

#### Scenario: Open incident is down
- **WHEN** an incident opens
- **THEN** last_status is down until that incident resolves
