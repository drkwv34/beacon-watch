# Tasks

## 1. Domain

- [ ] 1.1 Add `keys.ts` builders (`target:{id}:latest`, `statuspage:{slug}`, `ratelimit:public:{ip}:{window}`), `latestStatusTtlSeconds`, status-page TTL 15s, rate-limit window math, and `uptime24h`; verify unit tests for keys, TTL (interval 60 → 120, 90 → 180), remaining/retry-after, and uptime null when total is 0

## 2. Persistence and config

- [ ] 2.1 Add `findPublicTargetBySlug`, `findLatestCheck`, and 24h check success/total counts in `packages/db`; verify repository tests against Postgres
- [ ] 2.2 Parse `REDIS_URL`, short Redis timeouts, `PUBLIC_RATE_LIMIT_PER_MIN`, `TRUST_PROXY`, and `PUBLIC_CORS_ORIGINS` in API (and Redis URL/timeouts in worker) Zod config; add the same keys to `.env.example` and `docker-compose.yml`; verify config unit tests and `pnpm compose:config`

## 3. Redis adapters and worker cache

- [ ] 3.1 Add ioredis clients with fail-fast timeouts, versioned JSON get/set/del, and Lua fixed-window limiter; verify limiter unit tests plus an integration test that Redis-down cache writes warn and do not throw
- [ ] 3.2 After check commit, write `target:{id}:latest` and invalidate `statuspage:{slug}`; on target update/delete invalidate latest and old/new slug keys; verify check completion and target update delete the slug key, and that persist still succeeds when Redis is unreachable

## 4. Public API

- [ ] 4.1 Add unauthenticated `GET /api/public/v1/status/:slug` returning Appendix A JSON (cache-aside, identical 404 for private/missing slugs, CORS allowlist, `trustProxy` from config); verify contract/schema tests, private/slugless/unknown slugs share 404 bodies aside from request_id, and CORS default denies
- [ ] 4.2 Apply the public-only per-IP limiter with `X-RateLimit-Limit` / `X-RateLimit-Remaining` and 429 `Retry-After`; fail closed 503 `DEPENDENCY_UNAVAILABLE` if Redis is down; verify 61 requests from one IP → 61st is 429, a second IP is unaffected, FLUSHALL still serves the same body from DB, unreachable Redis returns 503 on the public route while the DB data path still works, and authenticated routes are not limited
- [ ] 4.3 Drop the scaffold-status line in `docs/architecture/caching-and-rate-limits.md`, report Redis on `/readyz` as ok or degraded, and add an optional `scripts/bench-public-status.ts` (not a CI gate); verify the doc no longer says scaffold-only and `/readyz` marks redis unavailable without 503 when Postgres is up

## 5. Integration check

- [ ] 5.1 Add a Redis 7 service to `.github/workflows/ci.yml` with `REDIS_URL`, then run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-cache-public-ratelimit --strict`; verify all exit 0

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head, merge locally with `--no-ff` as Christian Agila, then `openspec archive add-cache-public-ratelimit --yes` as a direct commit on main.
