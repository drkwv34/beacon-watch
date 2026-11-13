# Tasks

## 1. Failing regression coverage

- [ ] 1.1 Add mock-target `/redirect-to` that 302s to an absolute `url` query value and verify a mock-target unit test follows that Location
- [ ] 1.2 Add probe client tests (injected DNS/onRequest, Compose-like protection + `mock-target` exception) that a redirect from the demo host to 169.254.169.254, loopback, and RFC1918 returns `SSRF_BLOCKED` with no second-hop request, and verify they fail against current `SSRF_PROTECTION=false` behavior
- [ ] 1.3 Add worker config tests for `SSRF_HOST_EXCEPTION` parsing and the protected Compose defaults, and verify they fail until config exists
- [ ] 1.4 Add an API lookup test that create/update resolves only the submitted host and never fetches, and verify it passes on current `assertUrlAllowed`

## 2. Worker protection with exact host exception

- [ ] 2.1 Add worker `SSRF_HOST_EXCEPTION` in Zod `config.ts`, pass it into the probe client, and verify config tests pass
- [ ] 2.2 Re-validate every redirect hop with the exception matching only that hop's hostname, pin validated IPs at dial, and verify the 1.2 redirect tests pass
- [ ] 2.3 Warn at worker start when `SSRF_PROTECTION=false` and verify a unit/config-adjacent test or log assertion documents the warning path
- [ ] 2.4 Set Compose worker `SSRF_PROTECTION` default true with `SSRF_HOST_EXCEPTION=mock-target` (no subnet allowlist), document the vars in `.env.example`, and verify `pnpm compose:config` succeeds

## 3. Docs and create/update contract

- [ ] 3.1 Update `docs/architecture/external-integrations.md`, `apps/worker/src/probe/README.md`, `.cursor/rules/worker-probe.mdc`, and README hard-edges so Compose uses protection + exact host exception, and verify they state create/update does not follow redirects
- [ ] 3.2 Keep API lookup fetch-free (comment + 1.4 test) and verify no `fetch`/`undici` is added under `apps/api`

## Workflow follow-up

- Archive this change after merge to `main`.
