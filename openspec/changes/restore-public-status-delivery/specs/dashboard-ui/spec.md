# Spec Delta

## MODIFIED Requirements

### Requirement: FR-PUB-001 Public status HTML
Unauthenticated `GET /s/[slug]` SHALL be server-rendered from a server-only public payload reader (Postgres, `is_public` filter, strict public DTO) and show target name, current state with text, last-24h uptime, recent incidents, and last checked time. Private, slugless, or unknown slugs MUST produce the same HTTP 404 before any HTML is flushed, with no ids, URLs, or owner identity.

#### Scenario: Public slug renders
- **WHEN** a public target with checks is requested at `/s/{slug}`
- **THEN** the page shows the name, a labelled status, uptime_24h as a percentage when not null, last checked time, and recent incidents

#### Scenario: Private and unknown are identical 404
- **WHEN** the slug is private, unused, or the target has no public_slug
- **THEN** the production HTTP status is 404 and the same not-found page is rendered with no target ids, URLs, or owner data

#### Scenario: Rate limited or Redis-down public API
- **WHEN** the public JSON API returns 429 or 503
- **THEN** the HTML page does not use that JSON response; Redis-down `/s/{slug}` is served from Postgres and JSON 429 does not apply to the HTML route

#### Scenario: Redis down still serves HTML
- **WHEN** Redis is stopped or unreachable and a public slug has state in Postgres
- **THEN** `GET /s/{slug}` returns 200 with that labelled status and incidents and MUST NOT show "Status temporarily unavailable"

#### Scenario: Reader failure does not crash
- **WHEN** the public payload cannot be loaded because Postgres is unreachable
- **THEN** the page shows "Status temporarily unavailable" and does not crash

### Requirement: FR-PUB-002 Status empty states
The public page MUST select copy from the public payload: no checks → "Monitoring starting…"; paused → "Monitoring is paused"; checks exist but none succeeded → "No successful checks yet."

#### Scenario: No checks
- **WHEN** check_count is 0 and status is not paused
- **THEN** the page shows "Monitoring starting…"

#### Scenario: Paused
- **WHEN** status is paused
- **THEN** the page shows "Monitoring is paused"

#### Scenario: Never succeeded
- **WHEN** check_count is greater than 0 and ever_succeeded is false and status is not paused
- **THEN** the page shows "No successful checks yet."
