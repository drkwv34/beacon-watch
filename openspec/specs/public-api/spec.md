# public-api Specification

## Purpose
Exposes an unauthenticated, rate-limited public JSON status API that never leaks private targets and fails closed when Redis cannot enforce the quota.

## Requirements

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
The public API SHALL limit each client IP to PUBLIC_RATE_LIMIT_PER_MIN (default 60) admitted GETs per sliding 60-second window in Redis. Rejections MUST NOT be stored as admissions. Public GET MUST send `X-RateLimit-Limit` and `X-RateLimit-Remaining`; 429 MUST add `Retry-After` (ceil seconds until the oldest admission expires, min 1). Client IP MUST be Fastify `request.ip` with `trustProxy`, never raw `X-Forwarded-For`. Dashboard routes MUST NOT use this limiter. OPTIONS MUST NOT consume quota.

#### Scenario: 61st request is 429
- **WHEN** one IP sends 61 public status GET requests within a sliding minute against a limit of 60
- **THEN** the 61st response is 429 RATE_LIMITED with Retry-After in seconds and X-RateLimit-Remaining 0

#### Scenario: Second IP is unaffected
- **WHEN** IP A is already over quota and IP B sends a first public request in the same minute
- **THEN** IP B is not 429

#### Scenario: Headers on success
- **WHEN** a public GET request is within quota
- **THEN** the response includes X-RateLimit-Limit and X-RateLimit-Remaining

#### Scenario: Sliding window holds past a Unix minute boundary
- **WHEN** one IP fills the quota near the end of a Unix minute and Retry-After is still positive after the clock crosses that minute
- **THEN** further GET requests from that IP remain 429 until the oldest admitted timestamp leaves the 60-second window

#### Scenario: Retry-After predicts the next admission
- **WHEN** a GET is rejected because the sliding window is full
- **THEN** Retry-After is at least 1, is the ceiling of seconds until the oldest admission expires, and a GET at that instant is admitted

#### Scenario: Concurrent admissions are process-wide
- **WHEN** 61 concurrent GET requests from one IP hit a limit of 60
- **THEN** exactly 60 are admitted and one is 429; the cap is not per process instance of the limiter math

#### Scenario: OPTIONS does not consume quota
- **WHEN** an IP is at quota and then sends OPTIONS /api/public/v1/status/:slug
- **THEN** OPTIONS is 204 and a subsequent GET from that IP is still 429

### Requirement: FR-PUB-004 Fail closed without Redis
If Redis is down or unreachable the public API rate limiter MUST fail closed with 503 DEPENDENCY_UNAVAILABLE on GET. Status data MUST still be readable from Postgres on that path (the limiter, not the cache read, is what returns 503). OPTIONS MUST NOT fail closed: it remains 204 and MUST NOT consult Redis.

#### Scenario: Unreachable Redis returns 503
- **WHEN** Redis is stopped or the client cannot complete a limiter command
- **THEN** GET /api/public/v1/status/:slug returns 503 DEPENDENCY_UNAVAILABLE

#### Scenario: Data path still works from DB
- **WHEN** Redis is unreachable
- **THEN** loading public status from Postgres still returns the Appendix A body (without going through the limiter)

#### Scenario: OPTIONS independent of Redis
- **WHEN** Redis is unreachable and a client sends OPTIONS /api/public/v1/status/:slug
- **THEN** the response is 204 and is not 503

### Requirement: FR-PUB-005 CORS allowlist
The public API SHALL apply a CORS origin allowlist from config. The default MUST be empty (no origins allowed). OPTIONS on the public status route MUST return 204 with no status body. Every public status response MUST send `Vary: Origin`. `Access-Control-Allow-Origin` MUST be set only for an exact allowlist match and MUST be omitted when the list is empty or the Origin is not listed. New env vars MUST be in `.env.example` and config validation.

#### Scenario: Default denies cross-origin
- **WHEN** PUBLIC_CORS_ORIGINS is empty and a browser origin requests the public API
- **THEN** Access-Control-Allow-Origin is not set to that origin

#### Scenario: Listed origin is allowed
- **WHEN** PUBLIC_CORS_ORIGINS includes https://status.example and that Origin is sent
- **THEN** the response allows that origin

#### Scenario: Empty allowlist OPTIONS is 204 without ACAO
- **WHEN** PUBLIC_CORS_ORIGINS is empty and a client sends OPTIONS with an Origin
- **THEN** the status is 204, the body is empty, Access-Control-Allow-Origin is absent, and Vary includes Origin

#### Scenario: Allowed origin OPTIONS is 204 with ACAO
- **WHEN** PUBLIC_CORS_ORIGINS includes https://status.example and OPTIONS sends that Origin
- **THEN** the status is 204, Access-Control-Allow-Origin is exactly that origin, and Vary includes Origin

#### Scenario: Disallowed GET never sends ACAO
- **WHEN** PUBLIC_CORS_ORIGINS includes https://status.example and GET sends Origin https://evil.example
- **THEN** Access-Control-Allow-Origin is not set

### Requirement: FR-PUB-002 Additive empty-state fields
`GET /api/public/v1/status/:slug` SHALL add `check_count` (total checks ever), `ever_succeeded` (true iff any check succeeded), and `recent_incidents` (opened_at, resolved_at, duration_seconds, status; no ids or URLs) while keeping Appendix A fields. Private and unknown slugs remain the same 404.

#### Scenario: No checks yet
- **WHEN** a public slug exists but has zero checks
- **THEN** check_count is 0, ever_succeeded is false, recent_incidents is [], and Appendix A nulls still apply

#### Scenario: Failed checks only
- **WHEN** a public slug has checks and none succeeded
- **THEN** check_count is greater than 0 and ever_succeeded is false

#### Scenario: Recent incidents without identity
- **WHEN** a public slug has an open or resolved incident
- **THEN** recent_incidents includes that incident's times, duration, and status and MUST NOT include target ids, check ids, URLs, or owner data

#### Scenario: Additive fields do not leak on 404
- **WHEN** the slug is private or unknown
- **THEN** the 404 body matches other 404s aside from request_id and still contains no target identity
