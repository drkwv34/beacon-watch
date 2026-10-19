# Tasks

## 1. Incident machine and persist sequences

- [ ] 1.1 Add named unit cases in `packages/domain/src/incidents/machine.test.ts` for fail then success (no open), fail then fail (open), and two successes resolving an open incident; verify those three tests pass under `pnpm test`
- [ ] 1.2 Keep or extend worker persist integration so fail then success writes no incident row and fail, fail, success, success leaves exactly one resolved incident; verify `scheduler.int.test.ts` (or equivalent) still passes against Postgres

## 2. Scheduler lease and semaphore

- [ ] 2.1 Confirm SKIP LOCKED lease tests still assert two concurrent claimers write one check and a claimed row is not due again; verify `claim.int.test.ts` and the two-worker `tick` case pass
- [ ] 2.2 Add scheduler `tick` integration that seeds more due targets than global max 1 and records peak in-flight probes; verify peak is 1
- [ ] 2.3 Add scheduler `tick` integration that seeds more same-host due targets than per-host max 1 and records peak in-flight probes to that host; verify peak is 1

## 3. Public 429 and SSRF gaps

- [ ] 3.1 Add or keep a public-status burst test that uses a unique IP (or flushed Redis key) and a small limit so the over-quota request is 429 RATE_LIMITED while a second IP is not; verify `public.int.test.ts` (or equivalent) passes with Redis
- [ ] 3.2 Extend probe-client SSRF tests to RFC1918 literals (`10.0.0.1` or `192.168.1.1`) with protection on, and keep create-time private URL 400s; verify those tests fail with SSRF_BLOCKED / VALIDATION_FAILED and never contact a third-party host

## 4. Playwright login smoke

- [ ] 4.1 Extend `e2e/dashboard-smoke.spec.ts` so the owner signs out and signs in before creating a mock-target monitor, then sees labelled status on the dashboard list and `/s/{slug}`; verify the spec still uses role/label selectors, retries stay at 1, and screenshots of the real UI are written
- [ ] 4.2 Keep e2e env `PUBLIC_RATE_LIMIT_PER_MIN` high enough (or distinct IPs) that the smoke does not 429 the public page; verify the workflow still sets that override

## 5. CI gate hardening

- [ ] 5.1 Keep the quality job order (format:check, lint, typecheck, test, build) and the e2e job Compose `--wait` plus log dump; verify `.github/workflows/ci.yml` still lists the e2e job with `--wait` and has no `continue-on-error` or skip
- [ ] 5.2 Upload Playwright traces and screenshots as artifacts on e2e failure; verify the workflow has an `if: failure()` upload-artifact step and still runs `down -v`

## 6. Docs

- [ ] 6.1 Update `docs/architecture/testing-strategy.md` so the pyramid table matches shipped tests and documents how to run `pnpm test` and `pnpm test:e2e` locally; verify those commands are named and Playwright is not described as local-only
- [ ] 6.2 Add the `quality` capability (NFR-MAINT-001, Day 7) to `openspec/project.md`; verify the capability map lists it

## 7. Integration check

- [ ] 7.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-test-ci-hardening --strict`; verify all exit 0

## Workflow follow-up

- Open a ready (non-draft) PR, embed a real-app screenshot of login → target list or public status, wait for CI green on the PR head including Playwright, merge locally with `--no-ff` as Christian Agila, then `openspec archive add-test-ci-hardening --yes` as a direct commit on main.
- `openspec validate --all --strict` after archive.
