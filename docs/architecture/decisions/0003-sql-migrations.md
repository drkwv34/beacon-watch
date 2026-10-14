# ADR 0003: Forward-only SQL migrations with `pg`

- Status: accepted (2026-10-14)
- Source: SRS §8.6; promised in Day 1 persistence.md

## Context

`packages/db` needed a migration tool before users, sessions, and targets could land. Persistence.md already chose the `pg` driver and plain parameterized SQL. The runner must be forward-only, record applied files, and run each file in one transaction.

## Decision

A small runner in `packages/db/src/migrate.ts`:

- Reads `packages/db/migrations/NNNN_description.sql` in lexical order.
- Creates `schema_migrations(filename text primary key, applied_at timestamptz)` if needed.
- Applies each pending file inside `BEGIN`/`COMMIT`; on error `ROLLBACK` and abort.
- Never edits a merged file; undo is a new forward migration.
- The API process applies pending files at boot so Compose does not need a separate migrate job.

## Consequences

- No ORM or migration DSL to learn; the SQL in git is exactly what Postgres runs.
- Down migrations are intentionally unsupported.
- Tests cover filename ordering and idempotent re-apply; CI applies `0001_users_sessions_targets.sql` against real Postgres.

## Rejected

- **node-pg-migrate / db-migrate** — extra DSL and JS interop for a handful of files.
- **Prisma / Drizzle migrate** — conflicts with “plain SQL, no ORM magic”.
- **Flyway / Liquibase** — JVM toolchain for a Node repo.
