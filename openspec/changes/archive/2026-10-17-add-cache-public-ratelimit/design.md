# Design

## Context

Day 4 persists checks and incidents in Postgres. Compose already runs Redis; API and worker configs do not parse `REDIS_URL`. `docs/architecture/caching-and-rate-limits.md` defines keys, TTLs, failure modes, and headers. See proposal.md for motivation. Public JSON shape is SRS Appendix A. No network IO inside a transaction; cache writes happen after commit.

## Goals / Non-Goals

**Goals:**

- One pure `keys.ts` plus TTL, window, and uptime helpers in `packages/domain`.
- Redis adapters in api and worker with short connect/command timeouts, `enableOfflineQueue: false`.
- Worker write-after-commit of `target:{id}:latest` and invalidation of `statuspage:{slug}`.
- API public route with cache-aside, fail-closed limiter, CORS allowlist, `trustProxy` from config.
- CI Redis service; integration tests use unique IPs or flush so they do not share limiter state.

**Non-Goals:**

- Next.js `/s/:slug`, dashboard UI, notifications, multi-region.
- Changing claim/probe, incident machine, or target CRUD contracts.
- Making the p95 benchmark a CI gate.

## Decisions

### 1. Keys, TTL, window math, and uptime live in domain

Pure functions: `targetLatestKey`, `statusPageKey`, `publicRateLimitKey`, `latestStatusTtlSeconds(interval) = max(2 * interval, 120)`, `STATUS_PAGE_TTL_SECONDS = 15`, fixed 60s window id `floor(epochSeconds / 60) * 60`, `uptime24h(successes, total) = total === 0 ? null : successes / total`. Call sites never concatenate key strings. Rejected: scattering `\`target:${id}:latest\`` in worker and api (violates the architecture table).

### 2. Versioned JSON envelope

Cache values are `{ "v": 1, ...payload }`. HTTP responses strip `v`. Unknown `v` on read is treated as a miss. Rejected: unversioned blobs (a deploy that changes shape would need FLUSHALL).

### 3. ioredis with fail-fast sockets

`ioredis` in api and worker (commandTimeout is first-class). Defaults: connect 200ms, command 200ms, `maxRetriesPerRequest: 1`, `enableOfflineQueue: false`, `lazyConnect: true`. Boot does not crash if Redis is down. Cache get/set/del catch errors, log `warn`, return miss / skip write. Limiter errors throw `DomainError('DEPENDENCY_UNAVAILABLE')`. Rejected: hanging until TCP timeout; sharing a Postgres-style pool in `packages/db`.

### 4. Atomic fixed window via Lua

Key `ratelimit:public:{ip}:{windowStart}`. Lua INCR + EXPIRE on first hit, return `{count, ttl}`. Remaining = max(0, limit - count). Retry-After = ttl if ttl > 0 else window length. Inject `now` for tests. Rejected: GET+INCR without Lua (race under concurrency); sliding window (more keys, same SRS minute quota).

### 5. Client IP is `request.ip` only

`Fastify({ trustProxy: config.TRUST_PROXY })` with `TRUST_PROXY` boolean in Zod config (default false). Tests set `remoteAddress` on `inject`, never parse `X-Forwarded-For` in app code. Rejected: reading the header directly (spoofable).

### 6. Public route is a separate prefix

Register `/api/public/v1` outside the authenticated `/api/v1` plugin. Rate-limit hook on that prefix only. Auth gate tests stay on `/api/v1/__probe`. CORS (`@fastify/cors`) on the public plugin; `PUBLIC_CORS_ORIGINS` comma-separated, default empty.

### 7. Cache-aside for status; write-through latest after checks

Public GET: limiter → get `statuspage:{slug}` → on miss load `findPublicTargetBySlug` (is_public AND slug) + latest check + 24h counts + open incident → set cache → return Appendix A fields. Worker after tx2 commit: SET latest with TTL, DEL statuspage slug. Target update/delete after commit: DEL latest and old+new slug keys. No Redis inside `withTransaction`.

### 8. Identical 404 via a single lookup

Only `SELECT … WHERE public_slug = $1 AND is_public = true`. Miss → `NOT_FOUND` with a fixed message (`Status page not found`). Never load a private row on this path, so ids/URLs cannot leak.

### 9. /readyz reports Redis as degraded, not fatal

Postgres down → 503. Redis ping fail → 200 `{ status: 'degraded', postgres: 'ok', redis: 'unavailable' }` because checks and authenticated routes still work. The public limiter still 503s independently.

### 10. Tests

Unit: keys, TTL, window remaining/retry-after, uptime_24h (including zero checks). Integration (CI Postgres + Redis): 61 requests from one IP → 61st 429; second IP ok; FLUSHALL then identical body from DB; Redis URL pointed at a closed port → limiter 503 and worker persist still works; check completion and target update delete `statuspage:{slug}`; private / unknown slugs share 404 JSON aside from request_id. Unique `remoteAddress` per test (or FLUSHALL in beforeEach). Script `scripts/bench-public-status.ts` is optional local, not CI.

## Risks / Trade-offs

- [Limiter vs cache on Redis down] → Public HTTP is 503 (fail closed). Cache-aside and worker persist still degrade; tested as separate paths so FLUSHALL (Redis up, empty) vs unreachable Redis are not conflated.
- [Shared Redis in CI] → Unique IPs and/or FLUSHALL per test; `fileParallelism: false` already. Never reuse `127.0.0.1` across limiter tests.
- [Fixed window burst at boundary] → Accepted; SRS is per-minute quota, not a token bucket. Documented in caching-and-rate-limits.md.
- [trustProxy default false] → Local Compose clients hit 127.0.0.1; operators set TRUST_PROXY=true behind a reverse proxy.

## Migration Plan

1. Add Redis client and config; CI Redis service. No SQL migration.
2. Rollback: revert the PR; Redis keys expire via TTL. No data loss in Postgres.

## Open Questions

None.
