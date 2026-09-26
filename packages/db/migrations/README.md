# Migrations

Forward-only SQL. Never edit or delete a migration that has reached `main`; add a new one instead.

- Naming: `NNNN_short_description.sql` (zero-padded, monotonically increasing).
- One logical change per file; each file runs in a single transaction.
- See [`docs/architecture/persistence.md`](../../../docs/architecture/persistence.md).

No migrations exist yet. The first ones (users, sessions, targets) arrive with the Day 2 OpenSpec change.
