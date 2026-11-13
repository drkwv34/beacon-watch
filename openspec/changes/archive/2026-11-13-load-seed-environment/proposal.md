# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-12 |
| Capabilities | portfolio, quality |
| FR / NFR IDs | NFR-PORT-001, SRS §9, SRS §4.4 |

## Why

`pnpm seed` reads `process.env` only. Compose injects `.env` into containers, not the host CLI, so the documented `cp .env.example .env && pnpm seed` path fails with missing `DATABASE_URL` / `DEMO_PASSWORD`. CI hides that by exporting those variables on the seed step.

## What Changes

- Load an optional repo-root `.env` before `parseSeedEnv`. Already-exported environment variables take priority. Missing file plus missing required exports fails with a safe error that names keys only (never the password).
- Do not hardcode credential fallbacks from `.env.example` or any other source.
- Keep the existing `db` → `127.0.0.1` hostname rewrite when `db` does not resolve. Keep idempotent upserts.
- README Demo MUST NOT call copying `.env` optional if seed requires it.
- CI e2e seed step reproduces the quickstart: `cp .env.example .env && pnpm seed` without special `DATABASE_URL` / `DEMO_PASSWORD` exports for that step.
- Not **BREAKING**: reviewers who already export the variables keep working; the `.env` file fills the documented path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `portfolio`: `pnpm seed` loads root `.env` with exported-env priority; README demo path requires the copy step for host seed.
- `quality`: the Compose e2e job seeds via the same quickstart command, not hidden seed-step exports.

## Impact

- Code: `packages/db/src/seed.ts`, new `packages/db/src/seed-cli.int.test.ts`, unit tests for dotenv merge.
- Config: none new; seed still uses `DATABASE_URL` and `DEMO_PASSWORD`.
- CI: `.github/workflows/ci.yml` e2e seed step.
- Docs: README Demo and testing-strategy local seed example.
- Out of scope: changing Compose service env injection; other findings.
