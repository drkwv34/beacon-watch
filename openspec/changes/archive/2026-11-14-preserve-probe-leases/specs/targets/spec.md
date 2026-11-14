# Spec Delta

## MODIFIED Requirements

### Requirement: FR-UI-004 Check now sets due immediately
Authenticated `POST /api/v1/targets/:id/check-now` SHALL accept the request with 202 and the public target envelope, MUST NOT probe the URL, and MUST NOT change 401/403/404 authz. For an enabled idle target it SHALL set `next_check_at` to now and the coalesced manual-check signal. For an enabled target with an active probe lease it SHALL leave that lease unchanged. For a paused target it MUST NOT enable the row or schedule a check.

#### Scenario: Owner marks due
- **WHEN** the owner POSTs check-now for an owned enabled idle target
- **THEN** the system returns 202 and next_check_at is now (the worker may claim it); no outbound HTTP runs in the API

#### Scenario: Non-owner cannot check now
- **WHEN** user B POSTs check-now for user A's target
- **THEN** the system returns 403 FORBIDDEN and next_check_at is unchanged

#### Scenario: CSRF mismatch is forbidden
- **WHEN** the owner POSTs check-now without a matching CSRF token
- **THEN** the system returns 403 FORBIDDEN and the schedule is unchanged

#### Scenario: In-flight check-now coalesces
- **WHEN** the owner POSTs check-now while a worker holds an active probe lease on that target
- **THEN** the system returns 202, the lease is unchanged, and no second probe is scheduled for that request

#### Scenario: Paused target is not reactivated
- **WHEN** the owner POSTs check-now for a paused target
- **THEN** the system returns 202, `enabled` stays false, and the worker MUST NOT claim or probe it
