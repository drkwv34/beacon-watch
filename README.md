# beacon-watch

Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API.

[![CI](https://github.com/drkwv34/beacon-watch/actions/workflows/ci.yml/badge.svg)](https://github.com/drkwv34/beacon-watch/actions/workflows/ci.yml)

## Problem

HTTP services fail in ways that status pages and uptime robots both get wrong: a single blip pages someone, a cached badge lies after Redis dies, and a public JSON endpoint without a limiter is an abuse vector. Owners need a small, honest monitor: scheduled probes, flap-resistant incidents, and a public page that stays up when the cache does not.

## Why

beacon-watch is a portfolio-sized implementation of that problem with production constraints kept visible: SKIP LOCKED scheduling, an isolated probe client, an incident state machine, Redis as cache-only, and a public API that fails closed without a limiter. The Compose demo is the proof you can watch.

## Demo

```bash
cp .env.example .env          # optional; Compose already has safe local defaults
docker compose up --build --wait
pnpm seed                     # demo@beacon.local / DEMO_PASSWORD, slug demo, plus a paused target
```

Open [http://localhost:3000/s/demo](http://localhost:3000/s/demo). After the worker's first success the page is green (Up).

```bash
./scripts/demo-flap.sh         # mock-target /health → 500 for 45s, then 200
# or: ./scripts/demo-flap.sh 60
```

Watch `/s/demo` go **red** (Down, open incident) then **green** (Up, resolved). Sign in at [http://localhost:3000/login](http://localhost:3000/login) as `demo@beacon.local` with `DEMO_PASSWORD` from `.env.example` to see the dashboard, the paused second target, and Check now.

The live demo target uses interval 30s and grace/recovery 1 so one failed check is visible. **Product defaults for new monitors stay 60s and 2.**

![Public status page while the demo monitor is up](docs/screenshots/status-green.png)

![Public status page during a mock-target 500 flap](docs/screenshots/status-red.png)

![Owner dashboard with the seeded mock-target and paused example](docs/screenshots/dashboard.png)

## Stack

TypeScript (strict) · Node 22 · pnpm workspaces · Fastify · Next.js App Router · Postgres 16 · Redis 7 · Zod · pino · Vitest · Playwright · Docker Compose · GitHub Actions.

Why this split: the scheduler must not live inside a web request, and a slow target must never tie up the API ([ADR 0001](docs/architecture/decisions/0001-process-topology.md)). Domain logic stays pure in `packages/domain`; the only outbound HTTP to monitored URLs is `apps/worker/src/probe/`.

## Run locally

```bash
pnpm install
cp .env.example .env
docker compose up --build --wait
pnpm seed
curl -fsS localhost:4000/healthz
# Dashboard: http://localhost:3000/login  (demo@beacon.local)
# Public page: http://localhost:3000/s/demo
./scripts/demo-flap.sh
```

`pnpm seed` is idempotent (safe to re-run). It talks to Postgres on `127.0.0.1:5432` when Compose's `db` hostname does not resolve. The stored probe URL stays `http://mock-target:8080/health` so the worker can reach it on the Docker network.

Without Compose, the same apps can be run with `pnpm api`, `pnpm worker`, and `pnpm web` against local Postgres 16 and Redis 7. Create monitors pointed at `http://127.0.0.1:8080/health` only if the worker is not in Docker.

## Tests and CI

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm test` is Vitest (unit, API inject, contract, and `*.int.test.ts`). Integration tests need Postgres and Redis:

```bash
DATABASE_URL=postgresql://beacon:beacon@localhost:5432/beacon_test \
REDIS_URL=redis://127.0.0.1:6379 \
pnpm test
```

End-to-end (Playwright against Compose `--wait`, including NFR-PORT-001 red then green):

```bash
docker compose --env-file .env.example up -d --wait
pnpm seed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
MOCK_TARGET_URL=http://127.0.0.1:8080 \
PUBLIC_RATE_LIMIT_PER_MIN=1000 \
DEMO_PASSWORD=demo-password-change-me \
pnpm test:e2e
```

CI (every pull request and `main`): format check, lint, typecheck, Vitest, production build, Compose config/images, and Playwright e2e. Never skip the e2e job. Details: [`docs/architecture/testing-strategy.md`](docs/architecture/testing-strategy.md).

## Architecture

```mermaid
flowchart LR
  browser -->|"dashboard /s/[slug]"| web["apps/web Next.js"]
  web -->|HTTP| api["apps/api Fastify"]
  anon["anonymous"] -->|"GET /api/public/v1/status/:slug"| api
  api --> pg["Postgres 16\nsource of truth"]
  worker["apps/worker\nscheduler + probe pool"] -->|"SKIP LOCKED"| pg
  worker --> redis["Redis 7\ncache + rate limit"]
  api --> redis
  worker -->|"probe HTTP"| mock["mock-target"]
```

| Path | Role |
| --- | --- |
| `apps/api` | Fastify: auth, targets, public status JSON, rate limits |
| `apps/worker` | Scheduler and probe pool; the **only** code allowed to call monitored URLs |
| `apps/web` | Next.js dashboard and public `/s/[slug]` status pages |
| `packages/domain` | Pure TypeScript: types, error codes, incident state machine |
| `packages/db` | Forward-only SQL migrations, repositories, Appendix D seed |
| `mock-target` | Deterministic HTTP server for demos and CI (`POST /admin/fail`, `/admin/ok`) |
| `openspec/` | Change proposals; every product change starts here |
| `docs/architecture/` | Normative conventions and ADRs |

Sessions live in Postgres. The `beacon_session` cookie is HttpOnly, SameSite=Lax, and Secure in production. Mutating `/api/v1` requests after login need `x-csrf-token` (double-submit cookie `beacon_csrf`).

## Hard edges

- **Scheduling:** `FOR UPDATE SKIP LOCKED` claims a due row and sets `next_check_at = now + interval + jitter(0–10%)` in the same short transaction, so N workers never double-check a target. Probes run **outside** that transaction.
- **Redis cache:** keys `target:{id}:latest` (TTL `max(2 × interval, 120s)`), `statuspage:{slug}` (15s), `ratelimit:public:{ip}:{window}`. Invalidated on check commit and target update/delete. Redis down → status HTML and JSON **read** from Postgres; the public **limiter** fails closed (503).
- **Public rate limit:** `PUBLIC_RATE_LIMIT_PER_MIN` default **60**/IP/minute → 429 `RATE_LIMITED` with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`.
- **SSRF (Appendix C):** create/update and every probe hop resolve DNS, reject private/loopback/link-local/CGNAT/metadata addresses, cap body at 4 KiB, follow ≤ 3 redirects, hard-timeout the request. Compose sets `SSRF_PROTECTION=false` **on the worker only** so `http://mock-target:8080` works on the Docker network; the API stays protected with `SSRF_ALLOWLIST=mock-target`. Production keeps worker protection on.
- **Flaky targets:** grace/recovery default **2**, so one blip never opens an incident. The seeded demo uses 1 so the flap is visible in one check.

## Trade-offs

- Three processes instead of one: isolation over operational simplicity (ADR 0001).
- Redis is never a source of truth: a warm cache is fast; a missing cache is still correct; a missing limiter is a 503 rather than an open proxy.
- No in-check retries: flakiness is a domain counter, not hidden transport retries.
- Mock-target only in CI and the Compose demo: never probe real third-party hosts from tests.
- Notifications (Slack, email, PagerDuty) are out of scope for this MVP.

## Repository metadata

Values for the GitHub About panel (set manually; the API returns 403 for this account):

| Field | Value |
| --- | --- |
| Description | Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API. |
| Topics | `typescript`, `fastify`, `nextjs`, `postgresql`, `redis`, `docker`, `github-actions`, `monitoring`, `rate-limiting` |

## Contributing

Start with [`AGENTS.md`](AGENTS.md), [`openspec/README.md`](openspec/README.md), and [`docs/architecture/`](docs/architecture/README.md). Conventional commits; CI must be green before merge.

## License

[MIT](LICENSE) © Christian Agila
