# Design

## Context

Day 1 left `packages/db` as a stub (`MIGRATIONS_DIR` only), `apps/api` as Fastify plus `/healthz` and a central `DomainError` mapper, and `apps/web` as a scaffold homepage. See proposal.md for motivation. Normative constraints: one transaction per use case, no outbound HTTP from the API (SSRF at validation uses `node:dns` plus a pure IP classifier in `packages/domain`), `pg` + parameterized SQL, Zod config per app.

## Goals / Non-Goals

**Goals:**

- Composition-root wiring of pool, migration runner, cookie plugin, and auth/target modules so an authenticated user can CRUD targets in Compose.
- A testable SSRF port (`lookup`) so "DNS resolves to private" is hermetic.
- CI Postgres for `*.int.test.ts` without standing up Redis or the worker.

**Non-Goals:**

- Probe client, scheduler, Redis, public `/s/[slug]` or `/api/public/v1`.
- ORM, JWT access tokens, refresh-token rotation, email verification, password reset.

## Decisions

### 1. Migration runner: small `pg` SQL runner in `packages/db` (ADR 0003)

Apply `NNNN_*.sql` in lexical order inside a transaction, record filenames in `schema_migrations`. Rejected: node-pg-migrate (another DSL), Prisma/Drizzle (ORM against persistence.md), Flyway (JVM). API `main.ts` runs pending migrations at boot so Compose needs no extra migrate service.

### 2. Password hashing: Argon2id via `@node-rs/argon2`

Prebuilt native binaries including musl, so Alpine images do not need a compiler. OWASP-ish defaults (memory 19 MiB, iterations 2, parallelism 1). bcryptjs cost 12 is the documented fallback if a platform binary is missing; this change ships Argon2id.

### 3. Sessions: opaque cookie + hashed row in Postgres

Cookie `beacon_session` holds a 32-byte random token; the table stores `sha256(token)`, `user_id`, `expires_at`. Logout DELETEs the row. TTL is **7 days sliding**: each authenticated request that is more than 1 day from expiry extends `expires_at`. Hashing the token means a DB dump is not a session dump.

### 4. CSRF: double-submit cookie

Cookie `beacon_csrf` (not HttpOnly, SameSite=Lax) is set at login/register. Mutating `/api/v1` requests except register/login must send `x-csrf-token` equal to that cookie. No extra column. SameSite=Lax is the first barrier; double-submit is defense in depth as required.

### 5. Ownership HTTP mapping

Authenticated dashboard/API routes: unknown id → 404; existing row owned by someone else → 403 FORBIDDEN (FR-ERR-003). Public routes (out of scope) will use 404 for both. Documented in error-handling.md so Day 5 does not leak existence.

### 6. Auth gate on `/api/v1`

A Fastify plugin encapsulates `/api/v1` with a preHandler that requires a session except `POST /auth/register` and `POST /auth/login`. Unauthenticated hits, including `/api/v1/__probe`, return 401 so middleware tests never pin a future resource path.

### 7. SSRF validation in the API, classifier in domain

`packages/domain` exports pure `assertPublicUrl(url)` (scheme, no userinfo, blocked hostnames) and `isBlockedIp(address)`. The targets service, when `SSRF_PROTECTION` is true, calls an injected `lookup(hostname) → IP[]`, then `isBlockedIp` on every address. `SSRF_ALLOWLIST` is a comma-separated hostname list (Compose: `mock-target`). No `fetch`/`undici` in the API.

### 8. Target persistence

Table `targets` includes scheduling/incident counter columns (`next_check_at`, `last_status`, consecutive counters) so Day 3 does not rewrite the row shape. This change never claims or probes. Unique partial index on `public_slug`. Hard delete (SRS preference); ON DELETE CASCADE is declared on future child FKs when those tables exist.

### 9. Web: same-origin via Next rewrites

`next.config.ts` rewrites `/api/:path*` to `API_BASE_URL`. Browser talks only to the web origin; session cookies are host-only on that origin. `/login`, `/register`, `/dashboard`, `/dashboard/targets/new` are the stub. Dashboard is a server component that forwards cookies to `GET /api/v1/targets` (or uses the rewrite on the incoming host). Empty list → `StatePanel` with exact copy "Add your first monitor." and a CTA.

### 10. Integration tests

Vitest `*.int.test.ts` against real Postgres. CI quality job adds a `postgres:16-alpine` service and `DATABASE_URL`. Unit tests stay hermetic (classifier tables, Zod bounds, fake `lookup`). Local `pnpm test` runs units always; int tests skip unless `DATABASE_URL` is set, and fail hard when `CI=true` without it.

## Risks / Trade-offs

- [Native argon2 in Alpine] → `@node-rs/argon2` musl prebuild; lockfile includes optional platform packages; CI/image build is the proof.
- [DNS at create time can be slow or fail] → 2s lookup timeout; failure → VALIDATION_FAILED on `url`, not INTERNAL.
- [403 on non-owner leaks existence] → accepted for FR-ERR-003 on authenticated routes; public routes stay 404 later.
- [Next rewrite vs CORS] → rewrite avoids cross-port cookies; API still listens on 4000 for curl and tests.
- [Sliding TTL writes] → at most one UPDATE per request and only when remaining TTL < 6 days, to avoid a write on every GET.

## Migration Plan

1. Ship ADR 0003 + runner + `0001_users_sessions_targets.sql`.
2. API boot applies pending files; empty local volume migrates cleanly; production (none yet) same.
3. Rollback: no down migrations. If needed, add a new forward file. Data loss on drop is acceptable before any production users.

## Open Questions

None. Session TTL (7 days sliding) and hard-delete are recorded here and in README so later days do not reopen them.
