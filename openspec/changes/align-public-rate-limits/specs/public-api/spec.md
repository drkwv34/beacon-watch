# Spec Delta

## MODIFIED Requirements

### Requirement: FR-PUB-004 NFR-SEC-002 Per-IP rate limit
The public API SHALL limit each client IP to PUBLIC_RATE_LIMIT_PER_MIN (default 60) admitted GET requests per sliding 60-second window, counted atomically in Redis. Rejected requests MUST NOT be stored as admissions. Every public GET response MUST send `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A 429 MUST add `Retry-After` in seconds (ceil of time until the oldest admission leaves the window, minimum 1). Client IP MUST come from Fastify `request.ip` with `trustProxy` set in config, never from raw `X-Forwarded-For`. Authenticated dashboard routes MUST NOT use this limiter. OPTIONS MUST NOT consume this quota.

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
