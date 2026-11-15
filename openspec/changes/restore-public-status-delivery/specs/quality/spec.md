# Spec Delta

## ADDED Requirements

### Requirement: FR-PUB-001 Production HTTP 404
`pnpm test:e2e` against the Compose production web image MUST assert that missing and private public-status slugs return HTTP 404, not 200 with a not-found body.

#### Scenario: Missing slug is HTTP 404
- **WHEN** an unauthenticated client requests `/s/{slug}` for a slug that does not exist
- **THEN** the production response status is 404

#### Scenario: Private slug is the same HTTP 404
- **WHEN** an unauthenticated client requests `/s/{slug}` for a target that exists with `is_public` false
- **THEN** the production response status is 404 and the body matches the missing-slug not-found page

### Requirement: NFR-REL-001 Isolated Redis-outage e2e
`pnpm test:e2e` MUST include a dedicated Redis-outage case that stops Redis, asserts HTML vs JSON, and starts Redis again in `finally` so later tests are not stranded.

#### Scenario: HTML 200 and JSON 503 with Redis stopped
- **WHEN** Compose Redis is stopped and `/s/demo` is requested
- **THEN** the HTML response is 200 with real status and incidents, and `GET /api/public/v1/status/demo` is 503

#### Scenario: Redis is restored after the case
- **WHEN** the Redis-outage test finishes, including on failure
- **THEN** Redis is running again before other e2e cases continue
