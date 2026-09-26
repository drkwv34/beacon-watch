# beacon-watch

Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API.

> **Status: architecture first.** This repo currently contains the scaffold only: workspace layout, conventions,
> OpenSpec, Compose, and CI. No probes, scheduler, incidents, or status page features exist yet. They land
> behind OpenSpec proposals in later milestones.

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

## Hard edges (designed, not yet built)

- **Scheduling:** `FOR UPDATE SKIP LOCKED` claims with a `next_check_at` lease, so N workers never double-check a target.
- **Probe isolation:** hard timeouts, 4 KiB body cap, ≤ 3 redirects, SSRF checks with DNS pinning on every hop.
- **Flaky targets:** grace/recovery thresholds (default 2) so one blip never pages anyone.
- **Cache failure modes:** Redis down → status pages serve from Postgres; the public API rate limiter fails closed.

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
```

## Contributing (humans and agents)

Start with [`AGENTS.md`](AGENTS.md), [`openspec/README.md`](openspec/README.md), and [`docs/architecture/`](docs/architecture/README.md).
Conventional commits; CI must be green before merge.

## License

[MIT](LICENSE) © Christian Agila
