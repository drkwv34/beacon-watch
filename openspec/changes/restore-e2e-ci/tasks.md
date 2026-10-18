# Tasks

## 1. Compose healthchecks and startup order

- [ ] 1.1 Make the worker `depends_on` the API with `condition: service_healthy` so boot migrations are not applied concurrently; verify `pnpm compose:config` still exits 0
- [ ] 1.2 Add API healthcheck `start_period: 40s` and interval 5s while keeping `wget` to `/healthz` and retries 10; verify the compose file still requires a healthy API before web (and now worker) start

## 2. Restore the Playwright CI job

- [ ] 2.1 Restore the `e2e` job (playwright smoke) with Compose `--wait --build`, wait-for-web, `pnpm test:e2e`, and `down -v`; add `--wait-timeout 120` and dump `ps`/`logs` on failure; verify `.github/workflows/ci.yml` lists the `e2e` job and still runs `--wait` (no skip)

## 3. Docs

- [ ] 3.1 Update `docs/architecture/testing-strategy.md` so E2E runs on PRs and `main` via Compose `--wait` + `pnpm test:e2e`, and fix any other current (non-archive) docs that say Playwright is local-only; verify those files no longer claim the smoke is local-only

## 4. Integration check

- [ ] 4.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate restore-e2e-ci --strict`; verify all exit 0

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head including the e2e job, merge locally with `--no-ff` as Christian Agila, then `openspec archive restore-e2e-ci --yes` as a direct commit on main.
- `openspec validate --all --strict` after archive.
