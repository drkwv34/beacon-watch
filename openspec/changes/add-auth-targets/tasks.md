# Tasks

## 1. Persistence

- [x] 1.1 Add `pg` to `@beacon-watch/db`, implement `withTransaction`, a lexical SQL migration runner, and `schema_migrations`; verify a unit test applies two fixture files then no-ops on re-run
- [x] 1.2 Write `0001_users_sessions_targets.sql` (users, sessions, targets, mandated partial unique slug index, `next_check_at` partial index) and ADR 0003; verify persistence.md names the runner and the migration file is forward-only SQL
- [x] 1.3 Implement users, sessions, and targets repositories (parameterized SQL, snake_case → camelCase, unique-violation → CONFLICT); verify repository mapping tests with a fake row object or int tests against Postgres

## 2. Domain validation and SSRF

- [x] 2.1 Add target field constants, branded ids, and `validateTargetInput` covering every SRS bound; verify unit tests for interval 29/3601, timeout 499/10001, method, body-on-GET, 8 KiB body, headers size, slug pattern
- [x] 2.2 Add pure `isBlockedIp` / hostname blockers (loopback, RFC1918, link-local, CGNAT, unspecified, IPv4-mapped, ULA, metadata names); verify a table-driven unit test for each class
- [x] 2.3 Export the new domain APIs from `packages/domain` and verify `pnpm --filter @beacon-watch/domain typecheck` passes

## 3. Auth API

- [x] 3.1 Extend API Zod config with `DATABASE_URL`, `SESSION_SECRET` (≥32), `SESSION_TTL_SECONDS` (default 7d), `SSRF_PROTECTION`, `SSRF_ALLOWLIST`; verify config tests and `.env.example` plus compose env are updated together
- [x] 3.2 Wire `@fastify/cookie`, session issue/lookup (hashed token, sliding TTL), Argon2id register/login/logout/me, CSRF double-submit, and the `/api/v1` gate that 401s `/api/v1/__probe`; verify unit/inject tests for cookie flags, CSRF reject, logout revoke, and the probe path
- [x] 3.3 Add Postgres integration tests for register, duplicate email 409, bad login 401, logout revoke, CSRF rejection; verify they run when `DATABASE_URL` is set and fail in CI without it

## 4. Targets API

- [x] 4.1 Implement targets module (schemas, service with one transaction, routes) including injected DNS `lookup`, allowlist, 50-target cap, 201/400/409; verify inject+int tests for bounds, SSRF classes (loopback, RFC1918, link-local, DNS-to-private via fake lookup), slug 409, owner 403 vs missing 404
- [x] 4.2 Document hard-delete policy and session TTL in README plus error-handling ownership mapping; verify the docs match 403-for-non-owner and 7-day sliding TTL
- [x] 4.3 Set Compose `SSRF_ALLOWLIST=mock-target` on the API (worker keeps `SSRF_PROTECTION=false`); verify `pnpm compose:config` succeeds

## 5. Web empty dashboard

- [x] 5.1 Add Next rewrite `/api/:path*` → `API_BASE_URL`, login/register pages, dashboard server component using StatePanel "Add your first monitor." with CTA, and a minimal new-target form; verify a Playwright screenshot of the real empty dashboard (no mocks)
- [x] 5.2 Add CI Postgres service and include `*.int.test.ts` in Vitest; verify `.github/workflows/ci.yml` sets `DATABASE_URL` and the quality job can reach Postgres

## 6. Integration check

- [x] 6.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-auth-targets --strict`; verify all exit 0

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head, merge locally with `--no-ff`, then `openspec archive add-auth-targets --yes`.
