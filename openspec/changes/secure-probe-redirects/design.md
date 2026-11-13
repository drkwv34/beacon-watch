# Design

## Context

See proposal.md for motivation. The probe client already re-runs `inspectProbeUrl` on each redirect and pins IPs when `SSRF_PROTECTION=true`. The hole is `protection=false`: it returns `addresses: []` before DNS/IP checks, and Compose hard-codes that on the worker so `mock-target` works. The API `assertUrlAllowed` already validates only the submitted URL (DNS + allowlist) and must stay fetch-free (`docs/architecture/external-integrations.md`).

## Goals / Non-Goals

**Goals:**

- Compose worker runs with protection on and an exact `mock-target` hostname exception.
- Each Location is independently classified; blocked hops never reach `undici` `request`.
- Pin the hop's validated address at dial; mixed DNS that includes a blocked answer is `SSRF_BLOCKED`.
- Loud warning when protection is explicitly off.

**Non-Goals:**

- Walking redirects at create/update time (decision already made: worker enforces at check time).
- Subnet or CIDR allowlists.
- Changing API `SSRF_ALLOWLIST` semantics.

## Decisions

### 1. Exact hostname exception, not protection-off and not a subnet list

Worker Zod config gains `SSRF_HOST_EXCEPTION`: comma-separated exact hostnames (lowercased, trailing-dot stripped), default empty. Compose worker sets `SSRF_PROTECTION=true` (or `${SSRF_PROTECTION:-true}`) and `SSRF_HOST_EXCEPTION=mock-target`.

For an excepted hostname, skip the private-IP reject after DNS so Docker RFC1918 answers are allowed, still resolve, and pin those addresses. Metadata hostnames remain blocked before the exception. IP literals never match the exception (no subnet allowlist).

Rejected: keep `SSRF_PROTECTION=false` in Compose (the bug). Rejected: reuse API `SSRF_ALLOWLIST` on the worker (API short-circuits before DNS; worker must pin and must not inherit the exception to the next hop). Rejected: allowlisting `172.16.0.0/12`.

### 2. Per-hop validation, then pin, then dial

Loop unchanged: parse Location against the previous URL, `inspectProbeUrl` the hop, abort with `SSRF_BLOCKED`/`DNS` before constructing the Agent when the hop is blocked. `connect.lookup` is the pin of that hop's validated addresses only.

Tests inject `lookup` and an `onRequest` spy (no real third-party hosts). mock-target gains `/redirect-to?url=` so a first hop to the demo host can emit an absolute Location to metadata/loopback/RFC1918. Assert `SSRF_BLOCKED` and that `onRequest` was not called for the second hop.

### 3. Create/update stay DNS-only

No change to `apps/api/src/lookup.ts` behavior. Document in spec/README/architecture that an allowlisted `mock-target` URL which later redirects to a private address is accepted at create and stored as `SSRF_BLOCKED` by the worker. Add a lookup test that resolves only the submitted host and never fetches.

### 4. Insecure mode is a boot warning, not a production hard reject

Unlike `PROBE_INSECURE_TLS`, `SSRF_PROTECTION=false` remains legal so local debugging still works. `main.ts` logs a warning naming that hops are unchecked and that this is not the Compose demo path. Config stays side-effect free.

### 5. Demo-flap and TLS unchanged

`/health` on `mock-target` stays 200 when the fixture is healthy. Redirect limit, body cap, total timeout, and TLS verification are untouched.

## Risks / Trade-offs

- [Docker DNS for `mock-target` is private] → hostname exception + pin, not protection-off.
- [Exception accidentally covers other hosts] → exact match only; redirects to IP literals or other names are fully checked.
- [Create accepts an open-redirect URL] → accepted contract; worker blocks at probe. Documented so charter scenario 5 is not silently treated as create-time 400.
- [False sense of safety if someone sets protection false] → boot warning.

## Migration Plan

1. Ship config + client + Compose env together so a rebuilt worker never probes with protection off unless explicitly requested.
2. Rollback: restore previous Compose `SSRF_PROTECTION=false` (not needed; exception preserves demo). No schema.

## Open Questions

None. Create/update redirect walking was decided: worker-only at check time.
