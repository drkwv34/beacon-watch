# Tasks

## 1. Appendix D seed

- [x] 1.1 Add `packages/db` seed (argon2 same as register) and root `pnpm seed` that migrates then upserts `demo@beacon.local`, public `mock-target` slug `demo` interval 30s, and one paused target; verify a seed integration test creates those rows
- [x] 1.2 Make seed idempotent (same user/targets on a second run, password hash refreshed from `DEMO_PASSWORD`) and read optional `DEMO_GRACE_THRESHOLD` / `DEMO_RECOVERY_THRESHOLD` for the live target only; verify the integration test running seed twice still has one user and two targets
- [x] 1.3 Document `DEMO_PASSWORD` and seed-profile grace overrides in `.env.example` without changing product interval/grace defaults; verify `apps/api` / domain defaults remain 60s and 2 in existing tests

## 2. Mock-target flap

- [x] 2.1 Keep or extend mock-target `POST /admin/fail` and `POST /admin/ok` (optional timed restore) so `/health` returns 500 then 200; verify a mock-target unit test toggles status without touching api/web
- [x] 2.2 Rewrite `scripts/demo-flap.sh` with `set -euo pipefail`, duration argument (default 45s), clear output, and restore after N seconds; verify `bash -n scripts/demo-flap.sh` and that `--ok` restores 200

## 3. NFR-PORT-001 e2e and CI

- [x] 3.1 Add `e2e/demo-flap.spec.ts` that signs in as the seeded demo user, waits for `/s/demo` Up, flaps mock-target to 500, observes Down and an open incident, restores, and observes Up/resolved; verify selectors are role/label based and retries stay at 1
- [x] 3.2 Keep `e2e/dashboard-smoke.spec.ts` and raise `PUBLIC_RATE_LIMIT_PER_MIN` in the e2e env; verify the workflow still starts Compose with `--wait` and has no `continue-on-error`
- [x] 3.3 Run `pnpm seed` in the e2e job after Compose is healthy, using host `DATABASE_URL` and `.env.example` `DEMO_PASSWORD`; verify `.github/workflows/ci.yml` still dumps logs and uploads traces on failure
- [x] 3.4 Update `docs/architecture/testing-strategy.md` and `openspec/project.md` so the pyramid names the flap e2e and the `portfolio` capability; verify those files mention NFR-PORT-001 / `pnpm seed`

## 4. README, env, screenshots

- [x] 4.1 Rewrite `README.md` in SRS §9 order including hard edges and a Repository metadata section with the About blurb and topics; verify the demo section names Compose up, seed, `/s/demo`, and `scripts/demo-flap.sh`
- [x] 4.2 Confirm `.env.example` lists `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `SSRF_PROTECTION`, `PUBLIC_RATE_LIMIT_PER_MIN`, `APP_BASE_URL`, `DEMO_PASSWORD`, and every other variable the apps read, with a Compose-only SSRF comment; verify `pnpm compose:config` still passes
- [x] 4.3 Capture Playwright screenshots of the real Compose app (`/s/demo` green, `/s/demo` red, dashboard) into `docs/screenshots/` and embed them in the README; verify the three PNG files are committed and referenced

## 5. Integration check

- [x] 5.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-readme-demo-flap --strict`; verify all exit 0

## Workflow follow-up

- Open a ready (non-draft) PR, embed the real-app screenshots in the PR body, wait for CI green on the PR head including Playwright, merge locally with `--no-ff` as Christian Agila, then `openspec archive add-readme-demo-flap --yes` as a direct commit on main.
- `openspec validate --all --strict` after archive.
