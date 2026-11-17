# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-17 |
| Capabilities | public-api |
| FR / NFR IDs | FR-PUB-004, FR-PUB-005, NFR-SEC-002, NFR-REL-001 |

## Why

The public JSON limiter uses a Redis key per Unix minute with a 60s TTL from the first increment, so a 429 that still advertises a positive `Retry-After` can become 200 as soon as the clock crosses the minute. Empty CORS allowlists disable the CORS plugin entirely, so an OPTIONS preflight is 404 instead of a data-free 204. SRS FR-PUB-004 asks for a token bucket or sliding window with a coherent retry, and FR-PUB-005 needs an exact origin allowlist that never leaks ACAO when the list is empty.

## What Changes

- Replace the fixed-minute Redis counter with an **atomic sliding window** of admitted request timestamps (Lua), one key per client IP, bounded expiry, and no memory growth from rejected requests.
- Compute `Retry-After` from the time the oldest admitted request leaves the window, with a minimum of 1 second and ceiling rounding so a 429 stays 429 until that instant.
- Keep GET `429 RATE_LIMITED` at quota and fail-closed `503 DEPENDENCY_UNAVAILABLE` when Redis cannot run the limiter. Do not count rejected requests as admitted.
- Answer `OPTIONS` on the public status route with **204**, no body, and **no quota consumption**. Set `Vary: Origin`. Send `Access-Control-Allow-Origin` only for an exact allowlist match; an empty allowlist never sends ACAO. Disallowed GET origins never receive ACAO.
- OPTIONS stays independent of Redis (still 204 when Redis is down). HTML `/s/[slug]` is unchanged and remains independent of this limiter.
- No **BREAKING** change to the public JSON body. Out of scope: dashboard session, other public JSON fields, HTML rate limiting.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `public-api`: FR-PUB-004 is a sliding window with coherent Retry-After; FR-PUB-005 adds explicit OPTIONS 204 preflight with exact-allowlist ACAO and Vary: Origin.

## Impact

- Code: `packages/domain` rate-limit math and `publicRateLimitKey(ip)`, `apps/api` Redis limiter Lua, public status routes/CORS, integration tests.
- APIs: `GET` and `OPTIONS /api/public/v1/status/:slug` headers and 429 timing; JSON body unchanged.
- Schema: none.
- Config: existing `PUBLIC_RATE_LIMIT_PER_MIN` and `PUBLIC_CORS_ORIGINS`; no new env vars.
- Docs: README hard-edge and `docs/architecture/caching-and-rate-limits.md` key/window table.
- Out of scope: dashboard session/nav, other findings, HTML status delivery.
