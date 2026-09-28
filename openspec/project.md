# Project context — beacon-watch

Planning context for OpenSpec is also in [`config.yaml`](config.yaml) (`context:` and `rules:`), which the CLI includes in artifact instructions.

## Purpose

Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API.
Users register HTTP targets; a worker checks them on a schedule; results are persisted to Postgres and cached in Redis;
flaky targets are smoothed with grace/recovery thresholds; public status pages degrade gracefully when Redis is down.

## Tech stack

TypeScript (strict) on Node 22 · pnpm workspaces · Fastify (API) · plain Node worker · Next.js App Router (web) ·
Postgres 16 · Redis 7 · Zod · pino · Vitest · Playwright (later) · Docker Compose · GitHub Actions.

## Topology

| Unit | Path | Owns |
| --- | --- | --- |
| API | `apps/api` | Auth, target CRUD, public status JSON, rate limiting, `/healthz` `/readyz` |
| Worker | `apps/worker` | Due-target claiming, probe pool, check persistence, incident transitions, cache writes |
| Web | `apps/web` | Dashboard, target detail, public `/s/[slug]` pages |
| Domain | `packages/domain` | Pure types, error codes, incident state machine, scheduling math |
| DB | `packages/db` | Forward-only SQL migrations, repositories, transaction helper |
| Mock target | `mock-target` | Deterministic HTTP server for Compose demos and CI |

Rationale: [`docs/architecture/decisions/0001-process-topology.md`](../docs/architecture/decisions/0001-process-topology.md).

## Conventions

All conventions are normative and live in [`docs/architecture/`](../docs/architecture/README.md). Summary:
layered imports (`apps → db → domain`, domain is pure), stable error codes, forward-only migrations, one
transaction per use case, structured logs with correlation IDs, and one isolated probe HTTP client.

## Capability map

Specs are created under `specs/<capability>/spec.md` when the first change for that capability is archived.

| Capability | FR / NFR IDs | Planned day |
| --- | --- | --- |
| `auth` | FR-AUTH-001..003, NFR-SEC-001 (session) | 2 |
| `targets` | FR-TGT-001..003, FR-ERR-003 | 2 |
| `scheduling` | FR-SCH-001, FR-SCH-003..005, NFR-PERF-002 | 3 |
| `probe` | FR-SCH-002, Appendix C, NFR-SEC-001 (SSRF), FR-ERR-002 | 3 |
| `incidents` | FR-INC-001..004, Appendix B, NFR-REL-002 | 4 |
| `caching` | FR-CACHE-001..003, NFR-REL-001, NFR-PERF-001 | 5 |
| `public-api` | FR-PUB-003..005, NFR-SEC-002 | 5 |
| `dashboard-ui` | FR-UI-001..004, FR-PUB-001..002, NFR-A11Y-001 | 6 |
| `observability` | NFR-OBS-001..002, FR-ERR-001 | cross-cutting |

## Domain constraints worth remembering

- Min check interval 30s, default 60s; timeout 500–10000 ms; ≤ 50 targets per user.
- Grace and recovery thresholds default to 2; one isolated failure never opens an incident.
- One open incident per target (partial unique index).
- If Redis is down: checks still persist, status HTML serves from Postgres, public JSON API rate limit **fails closed** (503).
- Never probe real third-party hosts in CI; always use `mock-target`.
