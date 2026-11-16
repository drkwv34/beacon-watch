# Spec Delta

## MODIFIED Requirements

### Requirement: FR-INC-003 Incident timeline
`GET /api/v1/targets/:id/incidents` SHALL require a session and return the owner's incidents newest first with `status`, `opened_at`, `resolved_at`, `trigger_check_id`, and `duration_seconds`. Open duration is now minus `opened_at`; resolved duration is `resolved_at` minus `opened_at`. Unknown ids MUST return 404. Another user's target MUST return 403 FORBIDDEN with `request_id` and no timeline. Unauthenticated callers MUST receive 401. A non-UUID id MUST return 400.

#### Scenario: Timeline includes open and resolved
- **WHEN** the owner has one open incident and one resolved incident
- **THEN** the response lists both newest first, each with duration_seconds, and the open item has `resolved_at` null

#### Scenario: Non-owner is 404
- **WHEN** an authenticated user requests incidents for a target they do not own
- **THEN** the system returns 403 FORBIDDEN with a `request_id` and does not include incident items

#### Scenario: Unknown id is 404
- **WHEN** the owner requests incidents for a well-formed id that does not exist
- **THEN** the system returns 404 NOT_FOUND

#### Scenario: Unauthenticated is 401
- **WHEN** a client with no session requests incidents for any target id
- **THEN** the system returns 401 UNAUTHENTICATED

#### Scenario: Invalid id is 400
- **WHEN** an authenticated owner requests incidents with an id that is not a UUID
- **THEN** the system returns 400 VALIDATION_FAILED
