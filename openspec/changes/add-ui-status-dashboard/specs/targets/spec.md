# Spec Delta

## ADDED Requirements

### Requirement: FR-UI-002 Owner checks list
Authenticated `GET /api/v1/targets/:id/checks` SHALL return the owner's recent checks newest first as `{ items }` with `checked_at`, `success`, `status_code`, `latency_ms`, `error_code`, and `error_message`. Unknown ids return 404. Another user's target returns 403. Unauthenticated requests return 401.

#### Scenario: Owner lists recent checks
- **WHEN** the owner GETs `/api/v1/targets/:id/checks` for a target with checks
- **THEN** the response is 200 and items are newest first with those fields

#### Scenario: Non-owner is forbidden
- **WHEN** user B GETs checks for a target owned by user A
- **THEN** the system returns 403 FORBIDDEN and does not include check rows

#### Scenario: Unknown id is 404
- **WHEN** the owner GETs checks for a well-formed id that does not exist
- **THEN** the system returns 404 NOT_FOUND

### Requirement: FR-UI-004 Check now sets due immediately
Authenticated `POST /api/v1/targets/:id/check-now` SHALL set `next_check_at` to now for the owned target and MUST NOT probe the URL. Unknown ids return 404. Another user's target returns 403. Unauthenticated requests return 401.

#### Scenario: Owner marks due
- **WHEN** the owner POSTs check-now for an owned enabled target
- **THEN** the system returns 200 and next_check_at is now (the worker may claim it); no outbound HTTP runs in the API

#### Scenario: Non-owner cannot check now
- **WHEN** user B POSTs check-now for user A's target
- **THEN** the system returns 403 FORBIDDEN and next_check_at is unchanged

### Requirement: FR-UI-001 Latest latency on target JSON
Owner target list and get responses SHALL include `latency_ms` of the latest check, or null when the target has never been checked, in addition to existing public target fields.

#### Scenario: Latency after a check
- **WHEN** the latest check stored latency 42
- **THEN** GET `/api/v1/targets` and GET `/api/v1/targets/:id` include latency_ms 42

#### Scenario: Never checked
- **WHEN** the target has zero checks
- **THEN** latency_ms is null
