# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-20 |
| Capabilities | portfolio (new); quality (modified) |
| FR / NFR IDs | NFR-PORT-001; SRS §9; §4.4; Appendix C #6; Appendix D |

## Why

Days 2–7 shipped auth, probes, incidents, cache, the dashboard, and the CI gate, but a reviewer still cannot follow a documented Compose path from seed to a public status page that goes red on 500 and green on restore. NFR-PORT-001 and SRS §9 are the Day 8 presentation acceptance: an Appendix D seed, a mock-target flap, CI proof, `.env.example`, and a README with hard edges.

## What Changes

- Idempotent `pnpm seed` creates `demo@beacon.local` (password from `DEMO_PASSWORD`), public target `mock-target` → `http://mock-target:8080/health` with slug `demo` and interval 30s, plus one paused second target. Running it twice MUST NOT duplicate rows.
- `scripts/demo-flap.sh` calls a mock-target admin endpoint to return 500 for N seconds (argument, sensible default) then restore 200. Admin is on mock-target only (Compose network / loopback publish); api and web never expose it.
- CI-run Playwright (or equivalent Compose e2e) proves NFR-PORT-001: mock 500 → incident open / status Down; restore → resolve / status Up. Shortened interval/grace only via the test/seed profile env, not product defaults.
- `.env.example` documents every variable the code reads, including `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `SSRF_PROTECTION` (false only for the Compose worker demo, with a comment), `PUBLIC_RATE_LIMIT_PER_MIN`, `APP_BASE_URL`, `DEMO_PASSWORD`. No real secrets.
- README rewrite in SRS §9 order: problem, why, demo, stack, run locally, tests/CI (badge + `pnpm test` / `pnpm test:e2e`), architecture, hard edges, trade-offs, Repository metadata (About blurb and topics; do not set them via API).
- Real Playwright screenshots of `/s/demo` green, `/s/demo` red during a flap, and the dashboard, committed under `docs/screenshots/` and embedded in the README.

No **BREAKING** product, schema, or API changes. Product defaults for interval (60s) and grace/recovery (2) stay.

## Capabilities

### New Capabilities

- `portfolio`: Compose demo seed (Appendix D), mock-target admin flap, `scripts/demo-flap.sh`, reviewer README (SRS §9 / NFR-PORT-001), and committed real-app screenshots.

### Modified Capabilities

- `quality`: The Playwright e2e job on Compose `--wait` MUST also prove the seeded demo monitor goes Down after mock-target 500 and Up after restore (NFR-PORT-001). Existing login smoke and the rest of the CI gate stay; no job may be deleted, skipped, or loosened.

## Impact

- Code: `packages/db` seed CLI; `mock-target` admin toggle; `scripts/demo-flap.sh`; Playwright spec; `.github/workflows/ci.yml` seed step; README; `.env.example`; `docs/screenshots/`.
- APIs: none on api/web. mock-target admin remains a fixture, not a product endpoint.
- Dependencies: argon2 already used by the API; seed reuses it from `packages/db` or the seed script.
- Schema: none (no new migration).
- Config: document existing vars; seed reads `DEMO_PASSWORD` and optional demo interval/grace overrides for the test profile only.
- Conventions: `docs/architecture/testing-strategy.md` names the flap e2e; `openspec/project.md` adds `portfolio`.

## Out of scope

- Slack/PagerDuty/email alerts; hosted demo deployment; new product features beyond seed + mock admin + demo script; pin-ready triage/closeout or release tag; browser synthetics against real third-party hosts; setting GitHub About/topics via API; rewriting pre-`225b773` history.
