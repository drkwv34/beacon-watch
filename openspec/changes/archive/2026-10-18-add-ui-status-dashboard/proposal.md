# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-17 |
| Capabilities | dashboard-ui, targets, public-api |
| FR / NFR IDs | FR-UI-001, FR-UI-002, FR-UI-003, FR-UI-004, FR-TGT-001, FR-TGT-003, FR-PUB-001, FR-PUB-002, FR-ERR-003, NFR-A11Y-001, NFR-SEC-001 |

## Why

Day 2 left a stub dashboard (plain list, create with three fields, no target detail). Day 5 shipped the public JSON API but no HTML status page. Owners still cannot see badges, checks, incidents, or a public `/s/[slug]` page. Day 6 finishes the Next.js UI against the existing API so a Compose demo can show green and red against mock-target.

## What Changes

- Target list (FR-UI-001, FR-TGT-003): status badges with text labels (`Up` / `Down` / `Paused` / `Unknown`), latency, last-checked time; empty list uses StatePanel copy and CTA **"Add your first monitor."**
- Target detail (FR-UI-002): recent checks table, incident timeline with open incidents highlighted, edit form with pause/resume and delete confirmation.
- Create form (FR-UI-003): SRS §3.2 fields with inline errors from `VALIDATION_FAILED.details.fields` and 409 slug-taken on the slug field.
- Public status page `GET /s/[slug]` (FR-PUB-001): server-rendered from the public JSON API (so Day 5 cache and limiter apply). Shows name, status with text, last-24h uptime, recent incidents, last checked. Private, slugless, or unknown slugs → the same Next.js 404 (no ids, URLs, or owner). API 429/503 → "Status temporarily unavailable" instead of crashing.
- Empty/error states (FR-PUB-002): no checks → "Monitoring starting…"; paused → "Monitoring is paused"; never succeeded → "No successful checks yet."
- Additive public JSON fields so those states can be distinguished: `check_count`, `ever_succeeded`, `recent_incidents`. Appendix A fields stay. Not **BREAKING**.
- Owner-only `GET /api/v1/targets/:id/checks` and `POST /api/v1/targets/:id/check-now` (FR-UI-004). Check now only sets `next_check_at = now()`; the API never probes. List/detail include latest `latency_ms`.
- Accessibility (NFR-A11Y-001): labelled inputs, keyboard path, sensible heading order, status never color-only.
- mock-target admin flap + `scripts/demo-flap.sh` so Compose can show red. README run section documents the UI path. Playwright smoke against the real stack.

Out of scope: browser synthetics, marketing site, notifications, new monitoring features, full README rewrite (Day 8), broad CI overhaul (Day 7), latency sparkline (Should; skip if time is short).

## Capabilities

### New Capabilities

- `dashboard-ui`: Authenticated dashboard (list, detail, create) and the public HTML status page `/s/[slug]`, including empty/error states, accessibility, and the owner-only Check now control.

### Modified Capabilities

- `targets`: Owner-scoped recent-checks list, Check now (sets `next_check_at = now()`), and latest `latency_ms` on target JSON so the list can show latency without a second round-trip.
- `public-api`: Additive fields `check_count`, `ever_succeeded`, and `recent_incidents` (no ids/URLs) so FR-PUB-002 states can be selected. Existing 404 no-leak and rate-limit contracts stay.

## Impact

- Code: `apps/web` (routes, components, Playwright), `apps/api` (checks list, check-now, public payload), `packages/db` (latest latency, immediate schedule, success/count helpers), `packages/domain` (empty-state selection), `mock-target` (health flap), README run section.
- APIs: `GET /api/v1/targets/:id/checks`, `POST /api/v1/targets/:id/check-now`; additive public JSON fields. Authenticated 403 vs 404 ownership unchanged; public 404 identical for private/unknown.
- Dependencies: `@playwright/test` for smoke against Compose; no new runtime deps.
- Schema: none (no migration).
- Config: none required; Playwright may raise `PUBLIC_RATE_LIMIT_PER_MIN` in the test env.
- Conventions: `docs/architecture/frontend-conventions.md` already binds this day; drop any remaining "stub" wording there and in testing-strategy only as needed for Playwright.
