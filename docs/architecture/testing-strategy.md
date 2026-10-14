# Testing strategy

Test hard edges and contracts thoroughly; don't chase line coverage on scaffolding.

## Pyramid

| Level | Tool | Scope | Runs in CI |
| --- | --- | --- | --- |
| Unit | Vitest | `packages/domain` (incident machine, jitter, scheduling math, SSRF classifier, rate-limit math), config parsing, error mapping | Every push/PR |
| API | Vitest + `app.inject()` | Route validation, error envelope, authz (403 vs 404 on public routes) without a network socket | Every push/PR |
| Integration | Vitest + Postgres service (Redis + mock-target from Day 3) | Auth sessions, target CRUD/SSRF/ownership; later `SKIP LOCKED`, Redis-down, 429 | Every PR (Postgres from Day 2) |
| Contract | Vitest + Zod schema | Public status JSON shape (SRS Appendix A) | Every PR (from Day 5) |
| E2E | Playwright | Create target → see check → open public page | PRs and `main` (from Day 7) |

## Rules

- Tests live next to code as `*.test.ts`; integration tests as `*.int.test.ts` (separate Vitest project once they exist).
- **Deterministic:** inject `Clock` and `random`; no `sleep` for timing, use fake timers or explicit polling with a deadline.
- **Hermetic:** only `mock-target` is probed; no external network in CI.
- Each integration test gets a fresh schema (or truncates) and never depends on test order.
- A bug fix lands with a test that fails without the fix.
- Playwright: role/label selectors only, one retry max, trace on failure.

## CI gate (`.github/workflows/ci.yml`)

`install --frozen-lockfile → format:check → lint → typecheck → test → build`, plus a parallel job that validates
`docker-compose.yml` and builds every image. The quality job provides Postgres 16 for `*.int.test.ts`. Playwright
is added when the Day 7 e2e suite lands.
