# Design

## Context

See proposal.md for why. Day 6 shipped Playwright smoke (`e2e/dashboard-smoke.spec.ts`) and PR #8 restored the `e2e` job with Compose `--wait --wait-timeout 120`, API `start_period`, worker `depends_on` healthy API, and Compose log dump on failure. Current `main` (`355683b`) already has most of the pyramid: `packages/domain` incident machine + SSRF + rate-limit math, `claim.int.test.ts` SKIP LOCKED, `scheduler.int.test.ts` persist sequences, `public.int.test.ts` 61st-request 429, probe-client SSRF for DNS-private and loopback. Docs still say integration “later SKIP LOCKED / 429”. Product specs are unchanged.

Constraints: domain stays pure; tests use mock-target only; Redis-down public limiter fails closed; auth unauthorized tests stay on `/api/v1/__probe`; never skip or loosen CI.

## Goals / Non-Goals

**Goals:**

- Close named gaps without rewriting passing tests.
- Extend Playwright to a login → create → status path on the real stack.
- Keep the three CI jobs; add failure artifacts for Playwright (traces/screenshots).
- Align testing-strategy and project-context with what CI actually runs.

**Non-Goals:**

- New product endpoints, env vars, or migrations.
- Splitting Vitest into multiple projects unless a file collides (it should not).
- Soak tests, coverage thresholds, or README rewrite.

## Decisions

### 1. Extend existing files; do not replace the pyramid

Add named incident cases next to `packages/domain/src/incidents/machine.test.ts`. Add `tick` semaphore cases to `apps/worker/src/modules/scheduling/scheduler.int.test.ts` (in-process mock-target + real Postgres). Keep `claim.int.test.ts` as the SKIP LOCKED proof. Rejected: a new test runner or deleting overlapping tests.

### 2. Semaphore proof is under `tick`, not only the unit Semaphore class

FR-SCH-005 is “claim batch MUST NOT exceed available global permits.” Unit tests already cap `Semaphore`. Integration will seed N due targets, inject a slow probe, set `global` max 1 (and a separate per-host max 1), and assert peak in-flight probes. Rejected: asserting only `tryAcquire` math.

### 3. Rate-limit tests keep unique IPs and flush

`public.int.test.ts` already uses `nextIp()` and `flushall` in `beforeEach`. Keep that; add a dedicated burst case that builds a fresh limiter-bound app with a low limit (e.g. 3) so the test is fast and does not share keys with the 60-request loop. Rejected: sleeping a minute. Rejected: sharing one IP across files.

### 4. Fill SSRF literal gaps on the probe client

Create-time SSRF in `targets.int.test.ts` already covers loopback, RFC1918, link-local, DNS-to-private. Probe-client test named “loopback and RFC1918” currently only hits `127.0.0.1`. Add `10.0.0.1` / `192.168.1.1` literals with protection on. Do not open sockets to those addresses (client must fail before connect). Rejected: hitting real metadata endpoints.

### 5. Playwright: register, sign out, sign in, then existing monitor path

Extend the existing spec rather than a second file (workers: 1, fullyParallel: false). After register lands on `/dashboard`, Sign out → `/login` → Sign in → create mock-target → list + `/s/{slug}`. Keep role/label selectors, `retries: 1`, CI `PUBLIC_RATE_LIMIT_PER_MIN=1000`. Capture screenshots of login (or list/public status) for the PR body. Rejected: skipping the existing flap assertions. Rejected: raising retries above 1.

### 6. CI: keep `--wait`; add Playwright artifacts; never skip

Leave job names, `--wait`, `--wait-timeout 120`, log dump, and `down -v` in place. On e2e failure upload `test-results/` (trace) and screenshot dir. Do not add `continue-on-error`. Quality job already requires `DATABASE_URL`/`REDIS_URL` (harness throws in CI if missing). Rejected: moving e2e behind a path filter. Rejected: Compose `--no-deps`.

### 7. Docs only name the pyramid and local commands

Update `docs/architecture/testing-strategy.md` so the table matches shipped tests and documents `pnpm test` (needs local Postgres/Redis for `*.int.test.ts`) and `pnpm test:e2e` (Compose up, then Playwright). Add `quality` to `openspec/project.md`. No README rewrite.

## Risks / Trade-offs

- [Semaphore integration uses real time for in-flight overlap] → Slow probe against mock-target `/slow` with a short timeout; assert peak via a counter, not `sleep` as the scheduler of record.
- [Playwright login extra round-trips vs public limiter] → Keep `PUBLIC_RATE_LIMIT_PER_MIN=1000` on the e2e job; unique slug per run.
- [CI time] → One extra Playwright path in the same spec; quality job unchanged order.
- [Screenshot for PR is a mock] → Forbidden. Capture from Compose-backed Playwright or a browser against the real web port.

## Migration Plan

1. Land tests + CI artifacts + docs on `test/ci-hardening`.
2. Rollback: revert the PR; gate remains Day 6 + PR #8 (undesired loss of named coverage only).
3. No SQL or config migration.

## Open Questions

None.
