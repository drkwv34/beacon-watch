# Migrations

Forward-only SQL. Never edit or delete a migration that has reached `main`; add a new one instead.

- Naming: `NNNN_short_description.sql` (zero-padded, monotonically increasing).
- One logical change per file; the runner applies each file in a single transaction and records it in `schema_migrations`.
- Tooling: the in-repo `pg` runner (`packages/db/src/migrate.ts`). See [ADR 0003](../../../docs/architecture/decisions/0003-sql-migrations.md).
- Conventions: [`docs/architecture/persistence.md`](../../../docs/architecture/persistence.md).
