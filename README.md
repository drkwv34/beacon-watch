# beacon-watch

Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API.

> **Status: auth + targets + scheduler/probes.** Session login, owner-scoped HTTP monitor CRUD, due-target
> claiming, and the isolated probe client are in. Incidents, Redis, and public status pages land behind later
> OpenSpec changes.

## What it will do

Register HTTP targets, check them on a schedule from an isolated worker, store every result in Postgres, cache the
latest state in Redis, open and resolve incidents with flap-resistant thresholds, and publish public status pages
plus a rate-limited JSON API that keep working when Redis doesn't.

## Architecture

```
browser ──▶ apps/web (Next.js) ──▶ apps/api (Fastify) ──▶ Postgres (source of truth)
                                        │                    ▲
anonymous ──▶ /api/public/v1 ───────────┘                    │ SKIP LOCKED claims
                                                             │
monitored targets ◀── probe client ◀── apps/worker ──────────┘──▶ Redis (cache + rate limit)
(mock-target in Compose/CI)
```

| Path | Role |
| --- | --- |
| `apps/api` | Fastify HTTP API: auth, targets, public status JSON, rate limits |
| `apps/worker` | Scheduler and probe pool; the **only** code allowed to call monitored URLs |
| `apps/web` | Next.js dashboard and public `/s/[slug]` status pages |
| `packages/domain` | Pure TypeScript: types, error codes, incident state machine |
| `packages/db` | Forward-only SQL migrations and repositories |
| `mock-target` | Deterministic HTTP server for demos and CI |
| `openspec/` | Change proposals; every product change starts here |
| `docs/architecture/` | Normative conventions and ADRs |

Why three processes: the scheduler must not live inside a web request lifecycle, and a slow target must never tie
up the API ([ADR 0001](docs/architecture/decisions/0001-process-topology.md)).

## Sessions

Server-side sessions live in Postgres. The `beacon_session` cookie is HttpOnly, SameSite=Lax, and Secure in
production. Sign-out deletes the row, so the cookie cannot be reused. Sessions last **7 days of inactivity**
(sliding `expires_at`; see `SESSION_TTL_SECONDS`). Mutating `/api/v1` requests after login need a matching
`x-csrf-token` header (double-submit cookie `beacon_csrf`).

## Targets

Fields and bounds follow SRS §3.2. **Delete is hard delete** of the target row (the SRS preference). Checks and
incidents do not exist yet; when they do they will `ON DELETE CASCADE`. When `SSRF_PROTECTION=true` (API default),
create/update resolve DNS and reject private, loopback, link-local, CGNAT, and metadata addresses. Compose keeps
the demo working by allowlisting `mock-target` (`SSRF_ALLOWLIST`) on the API and setting `SSRF_PROTECTION=false`
on the worker only so probes can reach `http://mock-target:8080` on the Docker network (Appendix C #6). Production
profiles must keep worker SSRF protection on.

## Hard edges

- **Scheduling:** `FOR UPDATE SKIP LOCKED` claims with a `next_check_at` lease, so N workers never double-check a target.
- **Probe isolation:** hard timeouts, 4 KiB body cap, ≤ 3 redirects, SSRF checks with DNS pinning on every hop.
- **Flaky targets:** grace/recovery thresholds (default 2) so one blip never pages anyone. (Day 4)
- **Cache failure modes:** Redis down → status pages serve from Postgres; the public API rate limiter fails closed. (Day 5)

Details: [`docs/architecture/`](docs/architecture/README.md).

## Stack

TypeScript (strict) · Node 22 · pnpm workspaces · Fastify · Next.js · Postgres 16 · Redis 7 · Zod · pino · Vitest · Docker Compose · GitHub Actions.

## Run it

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build

cp .env.example .env          # optional; Compose has safe local defaults
docker compose up --build     # api :4000, web :3000, mock-target :8080, Postgres, Redis
curl localhost:4000/healthz
# Register, then add a monitor at http://localhost:3000/dashboard
# Demo target URL: http://mock-target:8080/health (allowlisted on the API; worker SSRF is off in Compose)
# Slow fixture for timeout tests: http://mock-target:8080/slow?ms=2000
```

## Contributing (humans and agents)

Start with [`AGENTS.md`](AGENTS.md), [`openspec/README.md`](openspec/README.md), and [`docs/architecture/`](docs/architecture/README.md).
Conventional commits; CI must be green before merge.

## License

[MIT](LICENSE) © Christian Agila
