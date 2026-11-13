# Design

## Context

See proposal.md for motivation. `packages/db/src/seed.ts` already parses `DATABASE_URL` / `DEMO_PASSWORD` and rewrites Compose hostname `db` to `127.0.0.1`. Root `package.json` runs `tsx … packages/db/src/seed.ts` with no env loader. Node 22 `--env-file` errors if the file is missing, so loading belongs in the CLI.

## Goals / Non-Goals

**Goals:**

- Optional root `.env` load; exported env wins; safe key-only errors; keep hostname rewrite and idempotency.
- README and CI match `cp .env.example .env && pnpm seed`.

**Non-Goals:**

- A new dotenv dependency unless parsing becomes painful.
- Changing Compose container env.
- Hardcoded `demo-password-change-me` fallback.

## Decisions

### 1. Load `.env` from the repo root, merge without override

Resolve repo root from `import.meta.url` (`packages/db/src/seed.ts` → three parents). If `join(root, '.env')` exists, parse `KEY=VALUE` lines (ignore comments/blanks; strip matching quotes). For each key, set on a copy of `process.env` only when `processEnv[key] === undefined`. Do not mutate secrets into logs.

Rejected: `tsx --env-file=.env` (fails when the file is absent). Rejected: loading `.env.example` as a secret fallback.

### 2. Keep `parseSeedEnv` as the validator

`main()` becomes: merge file env → `parseSeedEnv` → rewrite `db` hostname → migrate → `seedDemo`. Existing invalid-key errors stay; optionally append that values may come from the environment or a root `.env`, still without echoing values.

### 3. CLI integration test in a subprocess

`packages/db/src/seed-cli.int.test.ts` spawns `tsx --conditions=@beacon-watch/source packages/db/src/seed.ts` with `DATABASE_URL` / `DEMO_PASSWORD` deleted from the child env and a temporary `.env` (via an injectable env-file path used only by tests, or by writing/restoring repo `.env`). Assert demo rows, second run does not duplicate, exported override wins, and stderr/stdout omit the password.

Prefer injecting `loadSeedProcessEnv({ processEnv, envFilePath })` plus one real spawn so the test does not clobber a developer `.env`. Spawn cwd is repo root; pass the temp file path through a well-named function argument, not a hidden product env var. The CLI `main` always uses the repo-root `.env`.

### 4. CI seed step unsets job-level credentials

E2e job currently sets `DEMO_PASSWORD` at job level and exports `DATABASE_URL` on the seed step. Change the seed step to:

```
cp .env.example .env
unset DATABASE_URL DEMO_PASSWORD DEMO_TARGET_URL DEMO_INTERVAL_SECONDS DEMO_GRACE_THRESHOLD DEMO_RECOVERY_THRESHOLD
pnpm seed
```

`.env.example` already has grace/recovery 1 and the Compose password placeholder. Job-level `DEMO_PASSWORD` remains for Playwright login after seed. `unset` in the step is required so the seed actually reads the file.

Local testing-strategy docs should show the same copy then seed, without implying exports are required.

## Risks / Trade-offs

- [Quoted or `export KEY=` dotenv features] → keep a small parser matching `.env.example`; no expansion.
- [Parallel tests writing repo `.env`] → CLI int test uses a temp file fed to `loadSeedProcessEnv`, plus a spawn that points at that file through `main`'s default only when cwd/root is isolated. Spawn with `env` stripped and a copied env file next to a computed root: implement `resolveSeedEnvPath()` as repo root `.env` and in the spawn test write that path with backup/restore in `try/finally`.
- [Empty-string exports] → treated as set (`!== undefined`), so they win and fail validation rather than being filled from the file. Documented as exported-env priority.

## Migration Plan

None. Operators who already export variables are unchanged.

## Open Questions

None.
