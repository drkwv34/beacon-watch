# Caching and rate limits

Redis holds nothing that cannot be recomputed from Postgres. Keys, TTLs, and failure modes below are implemented in the API and worker.

## Public JSON shape

`GET /api/public/v1/status/:slug` returns SRS Appendix A fields (`name`, `status`, `last_checked_at`, `latency_ms`,
`uptime_24h`, `open_incident`) plus additive FR-PUB-002 fields: `check_count`, `ever_succeeded`, and
`recent_incidents` (times, duration, status; no ids or URLs). Private and unknown slugs share the same 404 body
aside from `request_id`.

## Keys

| Key | Value | TTL | Written | Invalidated |
| --- | --- | --- | --- | --- |
| `target:{id}:latest` | JSON latest status | `max(2 × interval, 120s)` | after each check commit | target update/delete |
| `statuspage:{slug}` | JSON status page payload | 15s | on read miss | check commit for that target; target update |
| `ratelimit:public:{ip}` | sorted set of admitted GET timestamps | 60s | per admitted public GET | expiry |

- Keys are built by one helper module (`keys.ts`), never string-concatenated at call sites.
- Values are versioned JSON (`{ "v": 1, ... }`) so a deploy can change shape without flushing.

## Failure modes (NFR-REL-001; SRS §11 risk decision)

| Path | Redis unavailable | Why |
| --- | --- | --- |
| Worker writes check | Persist to Postgres, log `warn`, skip cache | Data first |
| Dashboard / status HTML page | `apps/web` SSR reads Postgres via a server-only `packages/db` reader (not the public JSON API) | Status pages must stay up when Redis is down |
| Public JSON API **cache read** | Fall back to Postgres | Same |
| Public JSON API **rate limiter** | **Fail closed: 503 `DEPENDENCY_UNAVAILABLE`** | Without a limiter the public API is an abuse vector |

## Rate limit (FR-PUB-004)

- Per client IP, `PUBLIC_RATE_LIMIT_PER_MIN` (default 60) **admitted GET** requests in a 60-second **sliding window**, implemented atomically in Redis (Lua over a ZSET of admission timestamps). Rejected requests are not stored.
- `Retry-After` on 429 is the ceiling of seconds until the oldest admission leaves the window, minimum 1, so a 429 stays 429 across a Unix minute until that instant.
- Headers on every public GET: `X-RateLimit-Limit`, `X-RateLimit-Remaining`; on 429 add `Retry-After` (seconds).
- Client IP comes from Fastify's `request.ip` with `trustProxy` configured explicitly; never trust a raw `X-Forwarded-For`.
- Authenticated dashboard routes are not rate limited by this limiter.
- `OPTIONS /api/public/v1/status/:slug` is **204**, does not consume GET quota, and does not consult Redis (still 204 when Redis is down). GET still fail-closes 503 without Redis.
- CORS: every public status response sends `Vary: Origin`. `Access-Control-Allow-Origin` is set only for an exact `PUBLIC_CORS_ORIGINS` match. An empty allowlist never sends ACAO.
