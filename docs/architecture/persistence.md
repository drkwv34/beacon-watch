# Persistence and migrations

- **Postgres 16 is the source of truth.** Everything in Redis can be rebuilt from it.
- **Driver:** `pg` with a shared `Pool` per process, created in the composition root. Query text is plain parameterized SQL in repositories.
  (Tooling choice is finalized in the Day 2 OpenSpec change; this doc is updated then.)
- **Migrations are forward-only** (SRS §8.6): `packages/db/migrations/NNNN_description.sql`. Never edit a merged migration.
  To undo, write a new migration. Each file runs in one transaction; the runner records applied files in `schema_migrations`.
- **Naming:** tables plural `snake_case`; timestamps `timestamptz`; ids `uuid` (generated with `gen_random_uuid()`); FKs `ON DELETE CASCADE` from checks/incidents to targets.
- **Indexes mandated by the SRS:** `checks (target_id, checked_at DESC)`; partial unique `incidents (target_id) WHERE status = 'open'`;
  `targets (next_check_at) WHERE enabled` for the due query; unique `targets (public_slug) WHERE public_slug IS NOT NULL`.
- **Retention:** raw checks 14 days, incidents 180 days, enforced by a periodic cleanup in the worker (batched deletes, never one giant `DELETE`).
- **Secrets:** `password_hash` only (argon2id or bcrypt ≥ 12). Target `headers` may contain tokens a user supplied; never log them.
