# Tasks

## 1. Domain

- [x] 1.1 Add `CheckId`, probe error-code closed set (`TIMEOUT`, `DNS`, `TLS`, `CONNECT`, `UNEXPECTED_STATUS`, `SSRF_BLOCKED`, `REDIRECT_LIMIT`, `INTERNAL`), and `truncateErrorMessage` (500 chars); verify unit tests for the set, type guard, and truncation
- [x] 1.2 Add pure `computeNextCheckAt(now, intervalSeconds, random)` with 0–10% jitter and `connectTimeoutMs`; verify unit tests for 0, ~0.5, and 1.0 random on a 60s interval (60s, 63s, 66s) and `min(2000, timeout_ms)`

## 2. Persistence

- [x] 2.1 Write forward-only `0002_checks.sql` (`checks` table, `ON DELETE CASCADE`, index `(target_id, checked_at DESC)`); verify the file is new SQL and persistence.md still names the runner
- [x] 2.2 Add `claimDueTargets` (SKIP LOCKED + lease) on the targets repository and a checks repository (`insertCheck`, `listChecksForTarget`); verify mapping tests plus Postgres integration that two concurrent claims never share a row

## 3. mock-target

- [x] 3.1 Add `/slow?ms=`, `/status/:code`, `/redirect/:n`, and `/large` (body > 4 KiB) next to `/health`; verify a local GET to `/slow` delays and `/health` still returns 200

## 4. Probe client

- [x] 4.1 Add worker `DATABASE_URL`, `PROBE_INSECURE_TLS` (rejected in production), keep defaults of max concurrency 20 and per-host 2; verify config tests and `.env.example` plus compose already document `SSRF_PROTECTION=false` on the worker
- [x] 4.2 Implement the undici probe client (dedicated Agent, total timeout, connect timeout, 4 KiB body cap, ≤ 3 redirects with SSRF re-check, User-Agent, no cookies, DNS pin when protection is on); verify unit tests for success, unexpected status, timeout against mock slow, redirect limit, body cap classified by status, and SSRF_BLOCKED
- [x] 4.3 Implement global and per-host semaphores; verify unit tests that global max and per-host max are respected under concurrent acquire

## 5. Scheduler

- [x] 5.1 Implement claim → probe → persist (two transactions, last_status from this check, no incident machine) and the poll loop with backoff; verify integration: success against mock `/health`, timeout against `/slow` without hanging, two workers one check row
- [x] 5.2 Document Compose `SSRF_PROTECTION=false` on the worker in README; verify the note matches `docker-compose.yml`

## 6. Integration check

- [x] 6.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-scheduler-probes --strict`; verify all exit 0

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head, merge locally with `--no-ff`, then `openspec archive add-scheduler-probes --yes`.
