# Testing strategy

Test hard edges and contracts thoroughly; don't chase line coverage on scaffolding.

## Pyramid

| Level | Tool | Scope | Runs in CI |
| --- | --- | --- | --- |
| Unit | Vitest | `packages/domain` (incident machine including fail/success no-noise and fail/fail open, jitter, scheduling math, SSRF classifier, rate-limit math, public empty-state copy), config parsing, error mapping, badge/empty-state mapping | Every push/PR |
| API | Vitest + `app.inject()` | Route validation, error envelope, authz (401 on `/api/v1/__probe`, 403 vs 404 on public routes) without a network socket | Every push/PR |
| Integration | Vitest + Postgres 16 + Redis 7 + in-process mock-target | Auth sessions, target CRUD/create-time SSRF/ownership, `SKIP LOCKED` lease / no double-check, scheduler `tick` global and per-host semaphores, incident open/resolve sequences, public 429 bursts with unique IPs, Redis-down fail-closed | Every PR (`*.int.test.ts`; missing `DATABASE_URL`/`REDIS_URL` fails the job in CI) |
| Contract | Vitest + Zod schema | Public status JSON shape (SRS Appendix A) | Every PR |
| E2E | Playwright | Login → add mock-target monitor → labelled status on dashboard and `/s/[slug]`; seeded `demo` monitor flaps red then green (NFR-PORT-001) (`pnpm test:e2e` against Compose) | Every PR and `main` (Compose `--wait` + host Playwright). Do not skip this job. |

## Local

### `pnpm test`

Vitest unit, API inject, contract, and integration tests. Integration files skip locally when `DATABASE_URL` or `REDIS_URL` is unset; in CI those variables are required.

```bash
DATABASE_URL=postgresql://beacon:beacon@localhost:5432/beacon_test \
REDIS_URL=redis://127.0.0.1:6379 \
pnpm test
```

Postgres 16 and Redis 7 must already be running (Compose `db`/`redis` or equivalent). Never point tests at real third-party hosts.

### `pnpm test:e2e`

Playwright against the published web port. Bring the full stack up first (`mock-target` only):

```bash
docker compose --env-file .env.example up -d --wait
DATABASE_URL=postgresql://beacon:beacon-local-only@127.0.0.1:5432/beacon \
DEMO_PASSWORD=demo-password-change-me \
pnpm seed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
E2E_TARGET_URL=http://mock-target:8080/health \
MOCK_TARGET_URL=http://127.0.0.1:8080 \
PUBLIC_RATE_LIMIT_PER_MIN=1000 \
DEMO_PASSWORD=demo-password-change-me \
pnpm test:e2e
```

Raise `PUBLIC_RATE_LIMIT_PER_MIN` in the e2e environment (or use distinct IPs) so the public page does not 429 itself. Role/label selectors only; one retry max; traces on failure.

## Rules

- Tests live next to code as `*.test.ts`; integration tests as `*.int.test.ts`.
- **Deterministic:** inject `Clock` and `random`; no `sleep` for scheduling clocks. Semaphore overlap tests may use a short delay inside a fake probe to measure peak in-flight work.
- **Hermetic:** only `mock-target` is probed; no external network in CI.
- Rate-limit tests must not share Redis IP keys (unique IPs or `FLUSHALL` per test).
- Auth unauthorized tests probe a never-routed path (`/api/v1/__probe`).
- Each integration test gets a fresh schema (or truncates) and never depends on test order.
- A bug fix lands with a test that fails without the fix.
- Playwright: role/label selectors only, one retry max, trace on failure.

## CI gate (`.github/workflows/ci.yml`)

`install --frozen-lockfile → format:check → lint → typecheck → test → build`, plus a parallel job that validates
`docker-compose.yml` and builds every image. The quality job provides Postgres 16 and Redis 7 for `*.int.test.ts`.
A third job brings Compose up with `--wait` (API healthcheck `start_period` and worker waits for a healthy API so boot
migrations are not raced) and runs `pnpm test:e2e` against the published web port. On e2e failure the job dumps
Compose `ps`/`logs` and uploads Playwright traces and screenshots. Never delete, skip, or loosen a job to get green.
