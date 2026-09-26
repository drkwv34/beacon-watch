# Caching and rate limits

Redis holds nothing that cannot be recomputed from Postgres. Scaffold status: Compose service only; behavior below lands on Day 5.

## Keys

| Key | Value | TTL | Written | Invalidated |
| --- | --- | --- | --- | --- |
| `target:{id}:latest` | JSON latest status | `max(2 × interval, 120s)` | after each check commit | target update/delete |
| `statuspage:{slug}` | JSON status page payload | 15s | on read miss | check commit for that target; target update |
| `ratelimit:public:{ip}:{window}` | counter | window length | per public API request | expiry |

- Keys are built by one helper module (`keys.ts`), never string-concatenated at call sites.
- Values are versioned JSON (`{ "v": 1, ... }`) so a deploy can change shape without flushing.

## Failure modes (NFR-REL-001; SRS §11 risk decision)

| Path | Redis unavailable | Why |
| --- | --- | --- |
| Worker writes check | Persist to Postgres, log `warn`, skip cache | Data first |
| Dashboard / status HTML page | Read from Postgres, log `warn` | Status pages must stay up |
| Public JSON API **cache read** | Fall back to Postgres | Same |
| Public JSON API **rate limiter** | **Fail closed: 503 `DEPENDENCY_UNAVAILABLE`** | Without a limiter the public API is an abuse vector |

## Rate limit (FR-PUB-004)

- Per client IP, `PUBLIC_RATE_LIMIT_PER_MIN` (default 60), fixed or sliding window implemented atomically in Redis (Lua or `MULTI`).
- Headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`; on 429 add `Retry-After` (seconds).
- Client IP comes from Fastify's `request.ip` with `trustProxy` configured explicitly; never trust a raw `X-Forwarded-For`.
- Authenticated dashboard routes are not rate limited by this limiter.
