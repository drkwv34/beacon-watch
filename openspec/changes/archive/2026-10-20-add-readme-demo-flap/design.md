# Design

## Context

See proposal.md for why. `main` already has mock-target `POST /admin/fail` and `/admin/ok`, a stub `scripts/demo-flap.sh` that toggles without a timed restore, `.env.example` with `DEMO_PASSWORD`, a README stub that mentions the flap path, and Playwright smoke that creates its own user and clicks Check now. There is no `pnpm seed`, no committed `docs/screenshots/`, and the smoke does not restore to green on the seeded `/s/demo` slug.

Constraints: domain stays pure; probes stay in `apps/worker/src/probe/`; no new migration; product interval/grace defaults stay 60/2; tests use mock-target only; never skip or loosen CI; screenshots MUST be from Compose, not mocked UI.

## Goals / Non-Goals

**Goals:**

- Idempotent seed via repositories + argon2 (same parameters as register).
- Timed mock-target flap script against Compose `--wait`.
- Playwright NFR-PORT-001 on the existing e2e job after seed.
- README §9 rewrite and committed real screenshots.

**Non-Goals:**

- Changing `INTERVAL_DEFAULT` / `THRESHOLD_DEFAULT`.
- Auto-seed on API boot in production.
- New product endpoints, alerts, or hosted demo.
- Setting GitHub About/topics via API.

## Decisions

### 1. Seed is a host CLI, not a boot hook

`pnpm seed` runs `packages/db/src/seed.ts` via `tsx --conditions=@beacon-watch/source` against `DATABASE_URL`. It migrates first, then upserts the demo user and two targets in one transaction. Rejected: seeding inside `apps/api` `main.ts` (surprising in production). Rejected: a Compose one-shot service (brief names `pnpm seed`). Host URL uses `127.0.0.1:5432`; stored target URL stays `http://mock-target:8080/health` for the worker.

Idempotency: find user by email; insert or update `password_hash` from `DEMO_PASSWORD`. Live target keyed by `public_slug = demo` owned by that user; paused target keyed by name `Paused example`. No extra rows on re-run.

### 2. Demo live target uses test-profile grace, not product defaults

Appendix D requires interval 30s. Product grace default is 2, which needs two failures. Seed reads `DEMO_GRACE_THRESHOLD` / `DEMO_RECOVERY_THRESHOLD` (default 1 in the seed profile only) so one failed check opens and one success resolves. Document that new monitors created in the UI still default to 60s / 2. Rejected: lowering `INTERVAL_MIN` in domain. Rejected: changing Zod defaults.

### 3. mock-target admin stays on the fixture port; script times the restore

Keep `POST /admin/fail` and `POST /admin/ok`. Add optional `?seconds=N` (or JSON) so fail auto-restores. `scripts/demo-flap.sh` uses `set -euo pipefail`, default duration 45s, prints the current `/health` status, and restores even if the duration is 0. `--fail` / `--ok` remain for tests. Admin is not added to api/web. Compose already publishes mock-target on `127.0.0.1:8080` only.

### 4. NFR-PORT-001 is a second Playwright spec on the same e2e job

Add `e2e/demo-flap.spec.ts`: seed must have run; sign in as `demo@beacon.local`; wait for `/s/demo` Up; POST admin fail; Check now (or wait for the 30s interval with grace 1); assert Down and an open incident; restore; Check now; assert Up and resolved. Keep `e2e/dashboard-smoke.spec.ts`. CI: after Compose `--wait`, run `pnpm seed` with localhost `DATABASE_URL` and `.env.example` `DEMO_PASSWORD`, then `pnpm test:e2e`. Keep `PUBLIC_RATE_LIMIT_PER_MIN=1000`. Rejected: replacing the login smoke. Rejected: a Vitest integration that never loads `/s/demo`.

### 5. Screenshots from the flap spec into `docs/screenshots/`

When `SCREENSHOT_DIR` is unset for the capture run, write `docs/screenshots/status-green.png`, `status-red.png`, and `dashboard.png`. CI keeps `SCREENSHOT_DIR=playwright-screenshots` (gitignored, uploaded on failure). Commit the three images from a real Compose Playwright run in this change.

### 6. README rewrite in place; do not set About via API

Replace the stub following SRS §9. Embed the three screenshots. CI badge points at `ci.yml`. Repository metadata section lists the About blurb and topics for manual setting. Hard edges cite SKIP LOCKED + jitter, cache keys/TTLs from `docs/architecture/caching-and-rate-limits.md`, 60/min 429 headers, and Appendix C / worker `SSRF_PROTECTION=false` only in Compose.

## Risks / Trade-offs

- [Seed against Compose from the host uses a different hostname than the worker] → Seed stores `http://mock-target:8080/health`; host `DATABASE_URL` uses `127.0.0.1`.
- [Grace 1 on the demo target looks like a product default] → README and seed logs call it demo-only; UI-created targets stay at 2.
- [Flap e2e vs public rate limiter] → Keep raised `PUBLIC_RATE_LIMIT_PER_MIN` on the e2e job; unique IPs already used in unit/integration limiter tests.
- [Check now vs waiting 30s] → Use Check now plus scheduler poll (1s) so CI stays inside the 25-minute job; interval 30s still matches Appendix D for unattended demo watching.
- [Screenshot of a mock] → Forbidden. Capture only against Compose web `:3000`.

## Migration Plan

1. Land seed, flap script, tests, README, and screenshots on `docs/readme-demo`.
2. Rollback: revert the PR; demo user is data-only and can be truncated.
3. No SQL migration.

## Open Questions

None.
