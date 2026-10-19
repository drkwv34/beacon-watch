# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-18 |
| Capabilities | quality (new) |
| FR / NFR IDs | NFR-MAINT-001; FR-INC-001..004, NFR-REL-002; FR-SCH-001, FR-SCH-005; FR-PUB-004, NFR-SEC-002; FR-SCH-002, NFR-SEC-001; NFR-REL-001 |

## Why

Days 2–6 shipped auth, probes, incidents, public status, and the dashboard, but the test pyramid and CI gate are still the Day 7 quality acceptance (SRS §7, NFR-MAINT-001). PR #8 restored Playwright against Compose `--wait`; that job must stay, and remaining gaps (named incident no-noise cases, scheduler semaphore under `tick`, isolated 429 bursts, probe-time SSRF literals, login-then-monitor smoke) must close without skipping or loosening any check.

## What Changes

- Keep and extend the existing Vitest + Playwright pyramid. No **BREAKING** product, schema, or API changes.
- Unit: incident machine named cases for FR-INC-001..004 / NFR-REL-002 (fail then success → no incident; fail, fail → open; consecutive successes resolve).
- Integration (Postgres + Redis + in-process mock-target, as the repo already does): scheduler SKIP LOCKED / no double-check (FR-SCH-001), global and per-host semaphore under `tick` (FR-SCH-005), incident open/resolve sequences (FR-INC-*), public rate-limit burst → 429 with unique IPs (FR-PUB-004, NFR-SEC-002), remaining SSRF rejection paths (FR-SCH-002, NFR-SEC-001).
- Playwright smoke (extend, do not delete): login → add mock-target monitor → status on dashboard and `/s/[slug]`. Flake control: role/label selectors, one retry max, `PUBLIC_RATE_LIMIT_PER_MIN` raised in the e2e env, no shared Redis IP state across limiter tests.
- CI full gate (NFR-MAINT-001): `format:check` → lint → typecheck → unit/integration → build, plus Compose config/images, plus Playwright e2e against Compose `--wait`. Never delete, skip, or loosen a job. Keep Compose log dump on e2e failure; add traces/screenshots as failure artifacts.
- Brief docs in `docs/architecture/testing-strategy.md` and `openspec/project.md` for what the pyramid covers and how to run `pnpm test` / `pnpm test:e2e` locally. Full README polish is Day 8.

Out of scope: soak / multi-day history; ICMP; Slack alerts; README rewrite; pin-ready polish; browser synthetics against real third-party hosts; deleting or skipping the e2e job.

## Capabilities

### New Capabilities

- `quality`: The committed test pyramid and GitHub Actions full gate that verify already-shipped product capabilities (incidents, scheduling, public rate limit, SSRF, dashboard smoke) without changing those product requirements.

### Modified Capabilities

- None. Existing `incidents`, `scheduling`, `probe`, `public-api`, and `dashboard-ui` requirement texts stay; this change only adds verification and CI/docs.

## Impact

- Code: Vitest unit/integration tests next to existing modules; `e2e/dashboard-smoke.spec.ts` login path; `.github/workflows/ci.yml` artifact upload. No new endpoints, env vars, or migrations.
- APIs: none.
- Dependencies: none (Playwright and Vitest already present).
- Schema: none.
- Config: e2e job already sets `PUBLIC_RATE_LIMIT_PER_MIN=1000`; keep that so smoke does not 429 itself.
- Conventions: `docs/architecture/testing-strategy.md`; `openspec/project.md` capability map for `quality`.
