# Probe module

The **only** place in the repo allowed to make outbound HTTP calls to monitored targets.
ESLint blocks `fetch`, `undici`, and `node:http(s)` everywhere else in `apps/api`, `apps/worker`, and `packages/*`.

The policy is normative: [`docs/architecture/external-integrations.md`](../../../../docs/architecture/external-integrations.md).

Compose keeps `SSRF_PROTECTION=true` on the worker and sets `SSRF_HOST_EXCEPTION=mock-target` so
`http://mock-target:8080` works on the Docker network (exact hostname, not a subnet allowlist).
The exception is not inherited by redirect hops: a Location to metadata, loopback, or RFC1918 is
`SSRF_BLOCKED` before any socket. The API keeps protection on, allowlists the demo hostname for
create/update of the initial URL only, and never follows redirects or fetches the target.
