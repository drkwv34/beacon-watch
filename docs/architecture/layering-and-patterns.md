# Layering and design patterns

## Layers inside each app

```
transport  →  use case (service)  →  domain  +  repositories  →  infra (pg, redis, probe)
```

| Layer | Lives in | Does | Must not |
| --- | --- | --- | --- |
| Transport | `apps/api/src/routes/*`, `apps/worker/src/main.ts` | Parse/validate input with Zod, call one use case, map result to HTTP/log | Contain business rules or SQL |
| Use case | `apps/*/src/modules/<capability>/service.ts` | Orchestrate one user-visible operation, own the transaction boundary | Import Fastify types or build HTTP responses |
| Domain | `packages/domain/src/*` | Pure functions and types: state machine, scheduling math, validation rules | Do IO, read the clock implicitly, import frameworks |
| Repositories | `packages/db/src/repositories/*` | Typed SQL for one aggregate; accept a transaction handle | Make decisions or call other repositories' tables ad hoc |
| Infra | `packages/db/src/client.ts`, `apps/worker/src/probe/*`, Redis clients | Connection pools, the probe HTTP client, cache adapters | Leak driver types above the repository/adapter boundary |

Folder convention per capability (created as capabilities land):

```
apps/api/src/modules/targets/{routes.ts, service.ts, schemas.ts}
apps/worker/src/modules/scheduling/{claim.ts, run-check.ts}
packages/domain/src/incidents/{machine.ts, machine.test.ts}
packages/db/src/repositories/targets.ts
```

## Patterns in use (and only these, until an ADR says otherwise)

- **Functional core, imperative shell.** Domain functions take state + event and return new state + intents
  (e.g. `applyCheckResult(counters, result) → { counters, action: 'open' | 'resolve' | 'none' }`). The shell performs the intents.
- **Repository** per aggregate (`targets`, `checks`, `incidents`, `users`). Plain SQL, no ORM magic.
- **Unit of work via transaction callback**: `withTransaction(pool, async (tx) => { ... })`. See [transactionality.md](transactionality.md).
- **Ports and adapters** only at real seams: `Clock`, `ProbeClient`, `Cache`, `RateLimiter`. Each has one production adapter and one test fake. No speculative interfaces.
- **Bounded worker pool with semaphores** (global + per-host) for probes.
- **Composition root** in each `main.ts`: build config → pools → adapters → services → transport. No global singletons elsewhere; pass dependencies in.

## Anti-patterns (reject in review)

- Generic `BaseService`/`BaseRepository` inheritance trees.
- Calling `fetch`/`undici` outside `apps/worker/src/probe` (lint-blocked).
- `setInterval` scheduling inside the API or Next.js (see ADR 0001).
- Reading `process.env` outside `config.ts`.
- `new Date()` inside domain code; inject `now` instead.
