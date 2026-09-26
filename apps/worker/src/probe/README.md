# Probe module (reserved)

The **only** place in the repo allowed to make outbound HTTP calls to monitored targets.
ESLint blocks `fetch`, `undici`, and `node:http(s)` everywhere else in `apps/api`, `apps/worker`, and `packages/*`.

Implemented on Day 3 (FR-SCH-002). The policy is normative and is written down in
[`docs/architecture/external-integrations.md`](../../../../docs/architecture/external-integrations.md).
