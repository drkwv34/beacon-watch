# Tasks

## 1. Failing CLI coverage

- [ ] 1.1 Add unit tests for dotenv parse/merge (exported wins, missing file, errors omit password) and verify they fail until helpers exist
- [ ] 1.2 Add `packages/db/src/seed-cli.int.test.ts` that spawns the seed CLI with DATABASE_URL/DEMO_PASSWORD unset and a temp `.env`, expects demo rows and a second idempotent run, and verify it fails with exit 1 on current CLI

## 2. Load root env in the seed CLI

- [ ] 2.1 Load optional repo-root `.env` before `parseSeedEnv`, keep exported env, keep `db`→`127.0.0.1` rewrite, and verify 1.1 plus existing seed unit tests pass
- [ ] 2.2 Make the CLI int test pass twice without duplicating rows, and verify override-export plus missing-env errors never print the password

## 3. README and CI quickstart

- [ ] 3.1 Stop calling `cp .env.example .env` optional in README Demo and verify the copy is required before `pnpm seed`
- [ ] 3.2 Change the e2e seed step to `cp .env.example .env && pnpm seed` without special seed-step exports, update testing-strategy if it still documents hidden exports, and verify `.github/workflows/ci.yml` matches

## Workflow follow-up

- Archive this change after merge to `main`.
