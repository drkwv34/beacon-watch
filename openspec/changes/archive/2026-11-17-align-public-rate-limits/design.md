# Design

## Context

See proposal.md for motivation. `RedisRateLimiter` keys `ratelimit:public:{ip}:{windowStart}` with Lua `INCR` + `EXPIRE 60` on first hit. `rateLimitWindowStartSeconds` is `floor(epoch/60)*60`, so a new key appears at each Unix minute even while the previous TTL (and Retry-After) is still positive. `registerPublicStatusRoutes` sets `@fastify/cors` `origin: false` when `PUBLIC_CORS_ORIGINS` is empty and attaches the limiter to every `onRequest`, including OPTIONS, so an empty list yields 404 on preflight. Domain stays pure; Redis IO stays in `apps/api`. HTML `/s/[slug]` does not use this limiter.

## Goals / Non-Goals

**Goals:**

- Atomic sliding window of admitted timestamps per IP, bounded key TTL, coherent Retry-After.
- Explicit OPTIONS 204 that never consumes GET quota and never sends ACAO unless the Origin matches the allowlist exactly.
- GET 429 at quota and GET 503 when Redis cannot run the limiter; OPTIONS independent of Redis.

**Non-Goals:**

- Token bucket with refill rate other than "60 admitted / 60s".
- Rate-limiting HTML or authenticated `/api/v1`.
- Changing Appendix A JSON fields.

## Decisions

### 1. Sorted-set sliding window, Lua, injected clock

One Redis key `ratelimit:public:{ip}` (builder in `keys.ts`, no window id). Lua: `ZREMRANGEBYSCORE` older than `now - 60s`, `ZCARD`, if `count < limit` then `ZADD` a unique member scored with `nowMs` and `PEXPIRE` the window; else do not `ZADD` and return the oldest score. `consume(ip, now)` passes `now.getTime()` so tests inject the clock; Redis `TIME` is not used. Rejected: fixed window (fails the minute-boundary Retry-After case); GET+INCR without Lua (races); storing rejected timestamps (memory grows with abuse).

### 2. Retry-After from the first freed slot

Domain helper: `rateLimitRetryAfterSeconds(oldestAdmittedMs, nowMs, windowMs)` = `max(1, ceil((oldest + window - now) / 1000))`. Remaining = `max(0, limit - admittedCount)`. Allowed iff the request was stored. Rejected: using key TTL of a minute-bucket (the current bug); Retry-After 0 on a 429.

### 3. Explicit OPTIONS 204; CORS headers in the public plugin

Skip the limiter when `request.method === 'OPTIONS'`. Register `OPTIONS /status/:slug` returning 204 with empty body, `Vary: Origin`, and `Access-Control-Allow-Methods: GET, OPTIONS`. Set `Access-Control-Allow-Origin` only when `Origin` is in the exact allowlist (string equality). Empty allowlist never sets ACAO. Apply the same ACAO/Vary rules on GET. Do not use `origin: false` to disable the OPTIONS route. Rejected: leaving empty-list CORS as plugin `origin: false` (404). Rejected: reflecting any Origin.

### 4. Tests

Domain: remaining/allowed, Retry-After ceil and min 1, key without window id. Redis + injected clock: fill quota near a minute boundary, still 429 after the boundary until the oldest timestamp expires; Retry-After matches next admission; 60 concurrent admits and 61st 429; IPs isolated; limit from config; Redis down → consume throws `DEPENDENCY_UNAVAILABLE`. HTTP: OPTIONS allowed / disallowed / empty list are 204 not 404 and do not consume GET quota; disallowed GET has no ACAO; OPTIONS with Redis pointed at a closed port is 204, GET is 503.

## Risks / Trade-offs

- [ZSET memory] → Members are only admitted requests; TTL is the window; unique member ids are UUID/random, not the millisecond (collisions would overwrite a score).
- [Clock skew vs Redis TIME] → Injected `now` is authoritative for the window so tests are deterministic; production `now` is the API clock already used on the route.
- [OPTIONS without Redis] → A flood of OPTIONS is not quota-limited; accepted because preflight must not 503 a browser and MUST NOT reveal status JSON.

## Migration Plan

1. Deploy API: old minute-bucket keys expire in ≤60s; new keys use the IP-only shape.
2. Rollback: revert the PR; leftover ZSET keys expire via TTL. No Postgres change.

## Open Questions

None.
