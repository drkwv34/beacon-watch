# Design

## Context

Day 2 shipped session auth, target CRUD, and a stub Next.js dashboard (`apps/web`: list without badges, create with name/url/method only, no detail or `/s/[slug]`). Day 5 shipped `GET /api/public/v1/status/:slug` (Appendix A: name, status, last_checked_at, latency_ms, uptime_24h, open_incident) with Redis cache-aside and a fail-closed limiter. Checks and incidents already persist. See proposal.md for motivation. Frontend contracts live in `docs/architecture/frontend-conventions.md`. `POST /targets/:id/check-now` is already named in `docs/architecture/transactionality.md` (set `next_check_at = now()`, no probe in the API).

## Goals / Non-Goals

**Goals:**

- Extend the stub UI; do not rewrite auth, proxy, or working CRUD.
- Add the two owner APIs the UI needs (checks list, check-now) plus additive public JSON for FR-PUB-002.
- Server-render `/s/[slug]` from the public API so Day 5 cache and 404/429/503 behavior apply.
- Keep domain pure; no `fetch` in api/worker; one transaction per use case; no network inside a transaction.

**Non-Goals:**

- Latency sparkline (Should; omit unless leftover).
- Auto-seeded demo user in Compose (document the UI path; Playwright creates its own target).
- Notifications, synthetics, marketing site, README rewrite, Playwright as the default `pnpm test` gate if the full stack is not in the quality job.

## Decisions

### 1. Route groups for chrome

Move authenticated/marketing pages under `app/(site)/` (same URLs) so `/s/[slug]` can use a brand-only layout. Rejected: hiding nav with CSS (still in the DOM, worse for a11y).

### 2. Public page fetches the public JSON API server-side

`/s/[slug]` uses `apiFetch`/`fetch(API_BASE_URL/api/public/v1/status/:slug)` with no session cookie. 404 → `notFound()`. 429/503 → StatePanel "Status temporarily unavailable". Rejected: reading Postgres from Next.js (web must not import `packages/db`).

### 3. Additive public fields, not a new endpoint

Appendix A stays. Add `check_count`, `ever_succeeded`, `recent_incidents` (timeline rows without ids). Empty-state selection is a pure domain helper (`selectPublicStatusNotice`) so badge/empty tests do not need a browser. Rejected: inferring "never succeeded" from `uptime_24h === 0` (that is only the last 24h).

### 4. Check now is schedule-only

`POST /api/v1/targets/:id/check-now` updates `next_check_at = now()` in one short transaction (no Redis, no probe). Authz matches other target mutations: 401 / 403 other owner / 404 unknown. Register the route before the `/api/v1` catch-all. Paused targets still accept the write; the worker only claims `enabled` rows, and the button is disabled when paused.

### 5. Checks list is owner-scoped and limited

`GET /api/v1/targets/:id/checks?limit=` (default 50, max 200). Same 401/403/404 as GET target. `listChecksForTarget` already exists; add a limit parameter.

### 6. Latency on list via a second query, not a migration

After listing targets, load latest `latency_ms` per id (`DISTINCT ON` / `= ANY`). `toPublicTarget` gains `latency_ms`. Rejected: storing last latency on `targets` (needs a migration and worker write).

### 7. mock-target in-process flap

`POST /admin/fail` and `POST /admin/ok` flip `/health` between 500 and 200. `scripts/demo-flap.sh` curls that. Rejected: restarting the container (slow for screenshots).

### 8. Tests

Unit: badge labels and `selectPublicStatusNotice`. API inject tests for checks list, check-now authz, additive public fields (keep identical 404 bodies; unique IPs or flush for limiter). Playwright smoke against Compose (`pnpm test:e2e`): register, create `http://mock-target:8080/health`, see the list, open `/s/{slug}`. Raise `PUBLIC_RATE_LIMIT_PER_MIN` in that env. Wire a CI job only if Compose `--wait` is reliable; otherwise run locally and say so.

## Risks / Trade-offs

- [Stale status page after flap] → Worker already DELs `statuspage:{slug}` after a check; Playwright waits for Down rather than sleeping a fixed 15s.
- [Public limiter vs Playwright] → Unique slugs, few public GETs, high test limit.
- [Check now vs paused] → Button disabled; API still 200 if called so scripts can queue a due time for resume.
- [SSR of `/s/[slug]` in standalone Next] → Fetch `API_BASE_URL` (Compose `http://api:4000`); 5s timeout already used by `apiFetch`.

## Migration Plan

1. No SQL migration. Rollback is revert the PR; public clients ignore unknown JSON fields.
2. Compose: rebuild web/api/mock-target.

## Open Questions

None.
