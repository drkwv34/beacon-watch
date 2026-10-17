# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-16 |
| Capabilities | caching, public-api |
| FR / NFR IDs | FR-CACHE-001, FR-CACHE-002, FR-CACHE-003, FR-PUB-003, FR-PUB-004, FR-PUB-005, FR-ERR-003, NFR-REL-001, NFR-SEC-001, NFR-SEC-002, NFR-PERF-001, SRS §11, Appendix A |

## Why

Checks and incidents live only in Postgres. Anonymous readers need a public JSON status API that stays fast on a warm cache, never leaks private targets, and cannot be abused if Redis is down. Day 5 lands the Redis cache and the rate-limited public API that `docs/architecture/caching-and-rate-limits.md` already specifies.

## What Changes

- Cache keys in one helper module (`keys.ts`), never concatenated at call sites. Values are versioned JSON (`{ "v": 1, ... }`).
- `target:{id}:latest` written after each check commit in the worker, TTL = max(2 × interval_seconds, 120s) (FR-CACHE-001).
- `statuspage:{slug}` written on public-status read miss, TTL 15s; invalidated on check completion for that target and on target update/delete (FR-CACHE-002). `target:{id}:latest` is also invalidated on target update/delete.
- Cache miss or Redis down: read from Postgres, log `warn`; the worker still persists checks (FR-CACHE-003, NFR-REL-001). Short Redis connect/command timeouts so a dead Redis does not stall requests.
- Unauthenticated `GET /api/public/v1/status/:slug` returns `{ name, status, last_checked_at, latency_ms, uptime_24h, open_incident }` exactly as SRS Appendix A (FR-PUB-003). `uptime_24h` is the share of successful checks in the last 24h, or null when there are no checks. `open_incident` is null or `{ opened_at, duration_seconds }`.
- Private, slugless, missing, or any non-public slug returns the same 404 body; responses never contain target ids, owner ids, URLs, headers, or body (FR-ERR-003, NFR-SEC-001).
- Per client IP rate limit `PUBLIC_RATE_LIMIT_PER_MIN` (default 60) per minute, atomic in Redis (Lua or MULTI). Headers `X-RateLimit-Limit` and `X-RateLimit-Remaining` on every public response; 429 adds `Retry-After` (seconds). Client IP from Fastify `request.ip` with `trustProxy` set explicitly in config; never trust raw `X-Forwarded-For`. Redis down → limiter fails closed with 503 `DEPENDENCY_UNAVAILABLE` (SRS §11). Dashboard/authenticated routes are not limited by it (FR-PUB-004, NFR-SEC-002).
- CORS allowlist for the public API via config, default none (FR-PUB-005). New env vars in `.env.example`, Zod config, and `docker-compose.yml`.
- No **BREAKING** changes: additive public route, Redis usage, and headers.

Out of scope (later days): Next.js `/s/:slug` page, dashboard changes, UI polish (Day 6); notifications; multi-region; new monitoring features. Playwright screenshot is N/A this night.

## Capabilities

### New Capabilities

- `caching`: Redis keys/TTLs for latest status and status-page payloads, versioned JSON, write-after-commit, invalidation, and Postgres fallback when Redis is missing or down.
- `public-api`: Unauthenticated public JSON status, identical 404 for non-public slugs, per-IP Redis rate limit that fails closed, rate-limit headers, and CORS allowlist.

### Modified Capabilities

- None. Existing `auth`, `targets`, `scheduling`, `probe`, and `incidents` requirements stay as shipped; this change consumes check persist, target update/delete, and incident rows they already own.

## Impact

- Code: `packages/domain` (key builders, TTL, rate-limit window math, uptime_24h), `packages/db` (public-by-slug lookup, 24h check aggregates, latest check), `apps/worker` (cache write/invalidate after check commit), `apps/api` (public route, limiter, CORS, cache read), CI Redis service.
- APIs: `GET /api/public/v1/status/:slug`. Authenticated `/api/v1` is unchanged and is not rate-limited by this limiter.
- Dependencies: Redis client (`ioredis`) in api and worker; `@fastify/cors` for the public plugin.
- Schema: none (no new migration).
- Config: `REDIS_URL`, `PUBLIC_RATE_LIMIT_PER_MIN`, `TRUST_PROXY`, `PUBLIC_CORS_ORIGINS`, short Redis timeouts.
- Conventions: drop the "Scaffold status" line in `docs/architecture/caching-and-rate-limits.md`; `/readyz` reports Redis as ok or degraded.
- CI: Redis 7 service alongside Postgres; integration tests use unique IPs or flush per test so they stay deterministic.
