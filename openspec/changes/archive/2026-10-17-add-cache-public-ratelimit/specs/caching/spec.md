# Spec Delta

## Purpose

Caches latest check status and public status-page payloads in Redis so reads stay fast, while Postgres remains the source of truth when Redis is empty or down.

## ADDED Requirements

### Requirement: FR-CACHE-001 Latest status key
The system SHALL, after each check commit, write Redis key `target:{id}:latest` with versioned JSON `{ "v": 1, ... }` for that target's latest status. TTL MUST be max(2 × the target's interval_seconds, 120 seconds). All cache keys MUST be built by one helper module and MUST NOT be string-concatenated at call sites.

#### Scenario: Write after successful persist
- **WHEN** a check is committed for a target with interval_seconds 60
- **THEN** `target:{id}:latest` exists as versioned JSON with TTL 120 seconds

#### Scenario: Longer interval raises TTL
- **WHEN** a check is committed for a target with interval_seconds 90
- **THEN** `target:{id}:latest` TTL is 180 seconds

#### Scenario: Redis down does not roll back the check
- **WHEN** Redis is unreachable at cache-write time
- **THEN** the check row remains in Postgres and the worker logs warn

### Requirement: FR-CACHE-002 Status page payload cache
The system SHALL cache the public status payload at `statuspage:{slug}` as versioned JSON with TTL 15 seconds, written on read miss. Check completion for that target and target update or delete MUST invalidate the slug key. Target update or delete MUST also invalidate `target:{id}:latest`.

#### Scenario: Read miss fills the cache
- **WHEN** a public status read misses `statuspage:{slug}` and the slug is a public target
- **THEN** the payload is loaded from Postgres and written to `statuspage:{slug}` with TTL 15 seconds

#### Scenario: Check completion invalidates the slug
- **WHEN** a check is committed for a public target with slug S
- **THEN** `statuspage:S` is deleted (or absent) after the write-after-commit path

#### Scenario: Target update invalidates both keys
- **WHEN** the owner updates or deletes a target that has id I and public_slug S
- **THEN** `statuspage:S` and `target:I:latest` are invalidated

#### Scenario: Slug change invalidates the old key
- **WHEN** the owner changes public_slug from old to new
- **THEN** `statuspage:old` is invalidated

### Requirement: FR-CACHE-003 NFR-REL-001 Degrade to Postgres
On cache miss or Redis unavailable the system SHALL serve status data from Postgres and log warn. The worker MUST persist checks when Redis is down. Redis connect and command timeouts MUST be short so a dead Redis does not stall requests.

#### Scenario: Flush still serves from DB
- **WHEN** Redis FLUSHALL has removed cached keys and a public target has checks in Postgres
- **THEN** GET public status returns the same JSON body as a cache hit would, sourced from Postgres

#### Scenario: Unreachable Redis still persists checks
- **WHEN** Redis is stopped or unreachable
- **THEN** the worker still inserts the check in Postgres and logs warn on the skipped cache write
