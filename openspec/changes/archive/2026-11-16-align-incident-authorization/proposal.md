# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-16 |
| Capabilities | incidents |
| FR / NFR IDs | FR-INC-003, FR-ERR-003, FR-AUTH-002 |

## Why

Authenticated `GET /api/v1/targets/:id/incidents` collapses a missing target and another user's target into `NOT_FOUND`. Target get/list/update/delete and the owner checks list already distinguish those cases (404 vs 403 FORBIDDEN, FR-ERR-003). Incident timeline authorization should match that authenticated mapping so a signed-in non-owner cannot be mistaken for an unknown id.

## What Changes

- `GET /api/v1/targets/:id/incidents` returns **403 FORBIDDEN** (`code: FORBIDDEN`, `request_id` present, empty body aside from the error envelope) when the target exists and belongs to another user. The timeline is not returned.
- The same route still returns **404 NOT_FOUND** for a well-formed UUID that does not exist, **401** without a session, and **400 VALIDATION_FAILED** for a non-UUID id.
- The owner still receives **200** with `{ items }`.
- Public status routes are unchanged: private and missing slugs remain 404 (no existence leak on anonymous reads).
- **BREAKING** for authenticated clients that treated a non-owner incident list as 404; the new code is 403. Public JSON/HTML are not affected.

Out of scope: API tokens, public incident payloads, worker incident machine, other endpoints.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `incidents`: FR-INC-003 owner timeline authorization matches targets/checks — non-owner is 403 FORBIDDEN, unknown id is 404 NOT_FOUND.

## Impact

- Code: `apps/api` incident service (and a small shared ownership helper if extracted), `apps/api/src/incidents.int.test.ts`.
- APIs: authenticated incident list status for another user's target changes from 404 to 403.
- Schema: none.
- Docs: `docs/architecture/error-handling.md` so incident routes are named next to targets/checks.
- Tests: failing regression first (non-owner currently 404), then green 403/404/401/400/200 coverage.
