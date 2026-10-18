# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-18 |
| Capabilities | none (CI / Compose tooling; `skip_specs: true`) |
| FR / NFR IDs | N/A (no product behavior change) |

## Why

Commit `1930a87` removed the Playwright smoke job from CI after `docker compose up -d --wait --build` failed because the API container exited on boot. Dropping the gate is forbidden. The smoke suite already exists (`pnpm test:e2e`); Compose healthchecks and startup order must keep `--wait` up through API boot so the job can run on every PR and `main`.

## What Changes

- Restore the `e2e` (playwright smoke) job in `.github/workflows/ci.yml` with the same Compose `--wait` + host Playwright path. Do not skip tests, drop `--wait`, or loosen retries/timeouts as a workaround.
- Fix Compose so the API stays up through boot: healthchecks and `depends_on` ordering so the worker does not race the API’s boot migrations, and `/healthz` is given a start period before failures count.
- Update `docs/architecture/testing-strategy.md` (and any other current docs that say Playwright is local-only) so the pyramid matches CI again.
- No **BREAKING** product changes. No schema, API, or env-var additions.

Out of scope: expanding the Day 7 e2e suite, changing Playwright selectors, new product features, GitHub merge-button workflow.

## Capabilities

### New Capabilities

- None. This is CI and Compose tooling.

### Modified Capabilities

- None. Dashboard, public-api, and targets requirements are unchanged; the existing Playwright smoke is wired back into CI.

## Impact

- Code: `docker-compose.yml` (API healthcheck start period, worker waits for a healthy API). `.github/workflows/ci.yml` (restore `e2e` job; dump Compose logs on failure).
- APIs: none.
- Dependencies: none (Playwright and `pnpm test:e2e` already landed in Day 6).
- Schema: none.
- Config: none.
- Conventions: `docs/architecture/testing-strategy.md`; drop “Playwright runs only locally” wording elsewhere that is still current (not archived OpenSpec history).
