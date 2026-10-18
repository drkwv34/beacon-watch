# Design

## Context

Day 6 landed `e2e/dashboard-smoke.spec.ts`, `pnpm test:e2e`, and a CI job that ran `docker compose --env-file .env.example up -d --wait --build` then Playwright against `127.0.0.1:3000`. See proposal.md for why that job was deleted. Failed run `39086806612`: images built; db/redis/mock-target became healthy; API started and **exited (1)** in under a second (`dependency failed to start: container beacon-watch-api-1 exited (1)`). Compose `--wait` never reached web. The job did not dump container logs.

Constraints: API and worker both call `migrate()` at boot (ADR 0003). Web `depends_on` API `service_healthy`. API healthcheck is `wget` to `/healthz` with interval 10s, retries 10, **no `start_period`**. Worker does not wait for API. No product, schema, or env-var change.

## Goals / Non-Goals

**Goals:**

- Keep `docker compose up --wait` up through API boot on a cold volume.
- Restore the Playwright smoke job on PRs and `main` without skipping `--wait` or the suite.
- Make the next Compose failure diagnosable (logs).

**Non-Goals:**

- Changing Playwright specs, selectors, or `pnpm test`.
- A separate migrate service or down-migrations.
- Loosening healthcheck success criteria (still HTTP `/healthz`).

## Decisions

### 1. Worker waits for a healthy API

API and worker start in parallel today after db/redis (and mock-target for the worker). Both apply forward-only SQL. A concurrent apply can make the second process throw (relation already exists / unique `schema_migrations`) and **exit 1**, which is what `--wait` reported.

Set worker `depends_on.api.condition: service_healthy`. API migrates, listens, `/healthz` passes; worker then migrates as a no-op. Rejected: dropping worker from `--wait` (hides a crash). Rejected: `restart: on-failure` (masks the race).

### 2. API healthcheck `start_period` so boot is not a failed probe

`/healthz` is valid only after `migrate()` and `listen()`. With `start_period` 0, a slow boot can mark the container unhealthy before it is serving. Add `start_period: 40s` on the API healthcheck; keep the existing `node -e fetch('/healthz')` probe. Interval 5s so `--wait` notices a successful listen sooner; retries stay 10. Rejected: removing the healthcheck or treating “started” as enough. Rejected: skipping `--wait`.

### 3. Restore the e2e job; dump Compose logs on failure

Put back the Day 6 `e2e` job (pnpm, Playwright Chromium, Compose `--wait --build`, wait-for-web, `pnpm test:e2e`, `down -v`). Add `--wait-timeout 120` so a 40s start period plus listen still fits Compose’s wait (default 60s can expire while status is `starting`). On failure, `docker compose ps -a` and `logs` before `down`. Same job env (`PUBLIC_RATE_LIMIT_PER_MIN=1000`, mock-target URLs, `PLAYWRIGHT_BASE_URL`).

### 4. Docs match the gate

`docs/architecture/testing-strategy.md` (and current “Playwright is local-only” lines, not archived change history) MUST say the smoke runs on PRs and `main` via Compose `--wait`.

## Risks / Trade-offs

- [API still exits for another reason (missing files, native module)] → Failure logs on the job; do not merge if e2e is red.
- [Worker-only `compose up worker`] → API is started because of `depends_on`; local full-stack `up` is the supported path.
- [start_period hides a crash for 40s] → Process **exit** still fails `--wait` immediately; start_period only ignores failed **probes** while the process is up.

## Migration Plan

1. Land Compose + workflow + docs on `fix/ci-playwright-smoke`.
2. Rollback: revert the PR; smoke is local again (undesired).
3. No SQL or config migration.

## Open Questions

None.
