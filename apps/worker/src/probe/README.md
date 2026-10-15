# Probe module

The **only** place in the repo allowed to make outbound HTTP calls to monitored targets.
ESLint blocks `fetch`, `undici`, and `node:http(s)` everywhere else in `apps/api`, `apps/worker`, and `packages/*`.

The policy is normative: [`docs/architecture/external-integrations.md`](../../../../docs/architecture/external-integrations.md).

Compose sets `SSRF_PROTECTION=false` on the worker so `http://mock-target:8080` works on the Docker network
(Appendix C #6). The API keeps protection on and allowlists the demo hostname.
