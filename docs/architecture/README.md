# Architecture — beacon-watch

These documents are **normative**. Code that contradicts them is a bug in the code or a missing doc update in the same PR.
They derive from SRS §8 (architecture constraints) and Appendix C (probe policy).

## System shape

```
                    ┌──────────────┐        ┌──────────────┐
  browser ────────▶ │  apps/web    │ ─────▶ │  apps/api    │ ─────┐
  (dashboard, /s/)  │  Next.js     │  HTTP  │  Fastify     │      │
                    └──────────────┘        └──────┬───────┘      │
  anonymous ───── GET /api/public/v1/status/:slug ─┘              │
                                                                  ▼
                    ┌──────────────┐   SKIP LOCKED   ┌───────────────────┐
                    │ apps/worker  │ ──────────────▶ │ Postgres 16       │
                    │ scheduler +  │                 │ (source of truth) │
                    │ probe pool   │ ──────┐         └───────────────────┘
                    └──────┬───────┘       │         ┌───────────────────┐
                           │ probe HTTP    └───────▶ │ Redis 7 (cache +  │
                           ▼                         │ rate-limit only)  │
                    monitored targets                └───────────────────┘
                    (mock-target in Compose/CI)
```

Postgres is the source of truth. Redis is a cache and a rate-limit store; losing it must never lose data.

## Dependency direction

```
apps/web ──▶ packages/domain            (types only; web talks to the API over HTTP, never to db)
apps/api ──▶ packages/db ──▶ packages/domain
apps/worker ─▶ packages/db ──▶ packages/domain
```

`packages/domain` imports nothing from the repo and nothing that does IO. ESLint enforces this.

## Index

| Topic | Doc |
| --- | --- |
| Layering and design patterns | [layering-and-patterns.md](layering-and-patterns.md) |
| Domain modeling | [domain-modeling.md](domain-modeling.md) |
| Error handling | [error-handling.md](error-handling.md) |
| Transactionality and concurrency | [transactionality.md](transactionality.md) |
| Persistence and migrations | [persistence.md](persistence.md) |
| Logging and observability | [logging-observability.md](logging-observability.md) |
| External integrations (probe client, SSRF, timeouts) | [external-integrations.md](external-integrations.md) |
| Caching and rate limits | [caching-and-rate-limits.md](caching-and-rate-limits.md) |
| Testing strategy | [testing-strategy.md](testing-strategy.md) |
| Frontend look-and-feel | [frontend-conventions.md](frontend-conventions.md) |
| App conventions (config, security, git, tooling) | [app-conventions.md](app-conventions.md) |
| Decisions (ADRs) | [decisions/](decisions/) |
