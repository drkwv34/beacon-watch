# Tasks

## 1. Failing coverage

- [x] 1.1 Add domain tests for sliding-window Retry-After (ceil, minimum 1) and `publicRateLimitKey(ip)` without a window id; add Redis limiter tests with an injected clock that fill quota near a Unix minute, stay 429 after the boundary until the oldest admission expires, match Retry-After to the next admission, admit 60 concurrent requests and reject the 61st, isolate IPs, honor a configured limit, and throw DEPENDENCY_UNAVAILABLE when Redis is down. Verify those cases fail on current main (minute-boundary GET is 200; key still includes window start).
- [x] 1.2 Extend `public.int.test.ts` so OPTIONS on `/api/public/v1/status/:slug` is 204 (allowed origin, disallowed origin, empty allowlist) with Vary: Origin, ACAO only on exact allowlist match, empty list never ACAO, no GET quota consumption, disallowed GET has no ACAO, and OPTIONS is 204 when Redis is unreachable while GET is 503. Verify OPTIONS empty-list is 404 and the minute-boundary HTTP case fails on current main.

## 2. Domain and limiter

- [x] 2.1 Change `packages/domain` key and window helpers to an IP-only sliding-window key and Retry-After from the oldest admitted timestamp. Verify 1.1 domain tests pass.
- [x] 2.2 Replace `RedisRateLimiter` with atomic Lua over a ZSET of admitted timestamps (no rejected members, bounded PEXPIRE, injected `now`). Verify 1.1 Redis tests pass, including 60 concurrent admits.

## 3. Public routes and docs

- [x] 3.1 Register explicit OPTIONS 204 on the public status route, skip the limiter for OPTIONS, and set Vary: Origin plus ACAO only for an exact allowlist match (empty list never ACAO). Verify 1.2 is green.
- [x] 3.2 Document the sliding-window key `ratelimit:public:{ip}`, coherent Retry-After, and OPTIONS 204 / empty-list ACAO rules in README and `docs/architecture/caching-and-rate-limits.md`. Verify those docs no longer describe a per-minute counter key.

## 4. Integration check

- [x] 4.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `openspec validate align-public-rate-limits --strict`; verify all exit 0.

## Workflow follow-up

- Archive this change after merge to `main`.
