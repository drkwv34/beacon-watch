# Spec Delta

## Purpose

Exposes an unauthenticated, rate-limited public JSON status API that never leaks private targets and fails closed when Redis cannot enforce the quota.

## ADDED Requirements

### Requirement: FR-PUB-003 Public JSON status
Unauthenticated `GET /api/public/v1/status/:slug` SHALL return `{ name, status, last_checked_at, latency_ms, uptime_24h, open_incident }` as SRS Appendix A. `uptime_24h` MUST be the share of successful checks in the last 24 hours, or null when there are no checks. `open_incident` MUST be null or `{ opened_at, duration_seconds }`.

#### Scenario: Up with no open incident
- **WHEN** a public slug has last_status up, a latest successful check, uptime in (0, 1], and no open incident
- **THEN** the body includes name, status "up", last_checked_at ISO-8601, latency_ms of the latest check, uptime_24h as a number, and open_incident null

#### Scenario: Down with open incident
- **WHEN** a public slug is down with an open incident
- **THEN** open_incident has opened_at and duration_seconds (now minus opened_at) and latency_ms may be null

#### Scenario: No checks yet
- **WHEN** a public slug exists but has zero checks
- **THEN** last_checked_at is null, latency_ms is null, uptime_24h is null, and open_incident is null

### Requirement: FR-ERR-003 NFR-SEC-001 No private leaks
A slug that is not public, has no public_slug, is missing, or belongs to anyone MUST return the same 404 body. The response MUST NOT contain target ids, owner ids, URLs, headers, or body.

#### Scenario: Private target is 404
- **WHEN** an unauthenticated client GETs a slug that exists on a target with is_public false
- **THEN** the status is 404 NOT_FOUND with the same body as an unknown slug

#### Scenario: Unknown slug is 404
- **WHEN** an unauthenticated client GETs a slug that does not exist
- **THEN** the status is 404 NOT_FOUND

#### Scenario: Bodies are identical
- **WHEN** comparing 404 responses for a private slug, a slugless target (via any unused slug), and an unknown slug
- **THEN** error.code is NOT_FOUND and the JSON objects match aside from request_id

### Requirement: FR-PUB-004 NFR-SEC-002 Per-IP rate limit
The public API SHALL limit each client IP to PUBLIC_RATE_LIMIT_PER_MIN (default 60) requests per minute, counted atomically in Redis. Every public response MUST send `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A 429 MUST add `Retry-After` in seconds. Client IP MUST come from Fastify `request.ip` with `trustProxy` set in config, never from raw `X-Forwarded-For`. Authenticated dashboard routes MUST NOT use this limiter.

#### Scenario: 61st request is 429
- **WHEN** one IP sends 61 public status requests within a minute against a limit of 60
- **THEN** the 61st response is 429 RATE_LIMITED with Retry-After in seconds and X-RateLimit-Remaining 0

#### Scenario: Second IP is unaffected
- **WHEN** IP A is already over quota and IP B sends a first public request in the same minute
- **THEN** IP B is not 429

#### Scenario: Headers on success
- **WHEN** a public request is within quota
- **THEN** the response includes X-RateLimit-Limit and X-RateLimit-Remaining

### Requirement: FR-PUB-004 Fail closed without Redis
If Redis is down or unreachable the public API rate limiter MUST fail closed with 503 DEPENDENCY_UNAVAILABLE. Status data MUST still be readable from Postgres on that path (the limiter, not the cache read, is what returns 503).

#### Scenario: Unreachable Redis returns 503
- **WHEN** Redis is stopped or the client cannot complete a limiter command
- **THEN** GET /api/public/v1/status/:slug returns 503 DEPENDENCY_UNAVAILABLE

#### Scenario: Data path still works from DB
- **WHEN** Redis is unreachable
- **THEN** loading public status from Postgres still returns the Appendix A body (without going through the limiter)

### Requirement: FR-PUB-005 CORS allowlist
The public API SHALL apply a CORS origin allowlist from config. The default MUST be empty (no origins allowed). New env vars MUST be in `.env.example` and config validation.

#### Scenario: Default denies cross-origin
- **WHEN** PUBLIC_CORS_ORIGINS is empty and a browser origin requests the public API
- **THEN** Access-Control-Allow-Origin is not set to that origin

#### Scenario: Listed origin is allowed
- **WHEN** PUBLIC_CORS_ORIGINS includes https://status.example and that Origin is sent
- **THEN** the response allows that origin
