# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-12 |
| Capabilities | probe, targets, portfolio |
| FR / NFR IDs | FR-SCH-002, NFR-SEC-001, FR-ERR-002, Appendix C, NFR-PORT-001 / SRS §4.4 |

## Why

Compose turns SSRF protection off for the whole worker so `http://mock-target:8080` can resolve on the Docker network. With protection off, `inspectProbeUrl` skips DNS and IP checks, so a redirect from the demo host to metadata, loopback, or RFC1918 is dialed. Appendix C requires every hop to be re-validated while the demo still needs an exact exception for `mock-target`.

## What Changes

- Enable `SSRF_PROTECTION` on the Compose worker. Allow the demo with an **exact hostname exception** for `mock-target` (not a subnet allowlist). The exception applies only to that hop: it is not inherited by the next Location.
- Every redirect Location is parsed and re-validated before any socket. Metadata hostnames, private/loopback/link-local literals, and private DNS results outside the exception are `SSRF_BLOCKED` with no connect. Validated IPs are pinned at dial (mixed DNS / rebinding).
- Keep ≤ 3 redirects, total timeout, TLS verification, and the demo-flap path (`/health` still succeeds).
- When `SSRF_PROTECTION=false` is set explicitly, the worker logs a clear warning that this is insecure local debugging, not the Compose demo path.
- Monitor create/update keeps its synchronous check of the **initial URL only**. No redirect following and no outbound fetch on the API. Redirects to blocked addresses are enforced by the worker at check time (`SSRF_BLOCKED`).
- Document the contract in the probe spec, worker probe README, and `docs/architecture/external-integrations.md`.
- Not **BREAKING**: demo probes to `mock-target` still succeed; previously unblocked open-redirect hops now fail the check instead of connecting.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `probe`: Compose demo runs with protection on plus an exact `mock-target` host exception; each redirect hop is independently validated and pinned; blocked hops return `SSRF_BLOCKED` without a second-hop socket; explicit insecure mode is warned.
- `targets`: Create/update SSRF remains a DNS/literal check of the submitted URL only (allowlist still lets Compose register `mock-target`); it MUST NOT follow redirects or fetch the target.
- `portfolio`: `.env.example` and README hard-edges describe worker protection on with a hostname exception, not `SSRF_PROTECTION=false` on the Compose worker.

## Impact

- Code: `apps/worker` probe client and config, `apps/worker/src/main.ts` warning, `apps/api/src/lookup.ts` comments/tests (no fetch), `mock-target` redirect-to fixture, `docker-compose.yml`, `.env.example`.
- APIs: no new endpoints; create/update status codes unchanged.
- Dependencies: none.
- Schema: none.
- Config: worker `SSRF_HOST_EXCEPTION` (exact hostnames). Compose worker `SSRF_PROTECTION=true` with exception `mock-target`.
- Conventions: `docs/architecture/external-integrations.md`, probe README, `.cursor/rules/worker-probe.mdc`.
- Out of scope: other findings; synchronous redirect walking on create/update; subnet allowlists; API outbound HTTP.
