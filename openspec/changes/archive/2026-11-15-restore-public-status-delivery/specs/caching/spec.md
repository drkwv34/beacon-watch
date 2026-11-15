# Spec Delta

## MODIFIED Requirements

### Requirement: FR-CACHE-003 NFR-REL-001 Degrade to Postgres
On cache miss or Redis unavailable the system SHALL serve status data from Postgres and log warn. Status HTML MUST keep serving from Postgres when Redis is down. The public JSON rate limiter MUST still fail closed with 503. The worker MUST persist checks when Redis is down. Redis connect and command timeouts MUST be short so a dead Redis does not stall requests.

#### Scenario: Flush still serves from DB
- **WHEN** Redis FLUSHALL has removed cached keys and a public target has checks in Postgres
- **THEN** GET public status returns the same JSON body as a cache hit would, sourced from Postgres

#### Scenario: Unreachable Redis still persists checks
- **WHEN** Redis is stopped or unreachable
- **THEN** the worker still inserts the check in Postgres and logs warn on the skipped cache write

#### Scenario: HTML stays up while JSON fails closed
- **WHEN** Redis is stopped and a public slug such as `demo` has state in Postgres
- **THEN** `GET /s/{slug}` returns 200 with that state and incidents, and `GET /api/public/v1/status/{slug}` returns 503 DEPENDENCY_UNAVAILABLE
