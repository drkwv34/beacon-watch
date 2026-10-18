# Spec Delta

## ADDED Requirements

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
