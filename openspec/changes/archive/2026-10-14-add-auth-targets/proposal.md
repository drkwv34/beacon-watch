# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-14 |
| Capabilities | auth, targets |
| FR / NFR IDs | FR-AUTH-001, FR-AUTH-002, FR-TGT-001, FR-TGT-002, FR-TGT-003, FR-ERR-003, NFR-SEC-001 (session + SSRF at validation) |

## Why

The Day 1 scaffold has no users, sessions, or monitors. Session authentication and owner-scoped target CRUD are the first product behaviors: without them nothing else (probes, incidents, status pages) has an account or a URL to check. This change lands those capabilities, including SSRF rejection at target validation and the empty-dashboard copy.

## What Changes

- Email/password register, login, and logout (FR-AUTH-001). Passwords hashed with Argon2id. Server-side sessions in Postgres so sign-out revokes immediately. Session cookies are HttpOnly, SameSite=Lax, and Secure in production. CSRF protection on every cookie-authenticated mutating request.
- Target create, read, update, pause (`enabled=false`), and hard delete (FR-TGT-001, FR-TGT-002), with SRS §3.2 fields and bounds. 201 on create, 400 on validation failure, 409 when `public_slug` is taken.
- When `SSRF_PROTECTION=true`, target create/update resolves DNS and rejects private, loopback, link-local, and other non-public addresses (NFR-SEC-001). Compose keeps `mock-target` usable via an explicit hostname allowlist.
- Every target read and mutation is scoped to the owning user (FR-AUTH-002). Authenticated non-owners receive 403 (FR-ERR-003). Missing ids receive 404. Public status routes are out of scope; when they land they will use 404 for both missing and private.
- Forward-only SQL migrations for `users`, `sessions`, and `targets`, plus the migration runner chosen in an ADR (promised in Day 1).
- Authenticated dashboard empty state: when the owner has zero targets, the UI shows "Add your first monitor." with a CTA via `StatePanel` (FR-TGT-003).
- No **BREAKING** changes: this is the first product API.

Out of scope (later days): worker probes and scheduler, incidents, Redis, public status pages and public JSON API, API tokens (FR-AUTH-003 Should).

## Capabilities

### New Capabilities

- `auth`: Email/password registration, session login/logout, cookie and CSRF policy, and ownership of subsequent authenticated requests.
- `targets`: HTTP monitor CRUD with SRS §3.2 validation, SSRF checks at create/update, owner scoping, hard-delete policy, and the empty-dashboard list state.

### Modified Capabilities

- None. `openspec/specs/` is empty; these are the first shipped capabilities.

## Impact

- Code: `apps/api` (auth + targets modules), `apps/web` (login/register + dashboard empty stub), `packages/domain` (target validation, SSRF IP classifier), `packages/db` (migrations, runner, repositories).
- APIs: `POST /api/v1/auth/register|login|logout`, `GET /api/v1/auth/me`, `/api/v1/targets` CRUD. Authenticated JSON under `/api/v1`.
- Dependencies: `pg`, `@fastify/cookie`, `@node-rs/argon2`.
- Schema: new tables `users`, `sessions`, `targets` (and `schema_migrations`).
- Conventions: `docs/architecture/persistence.md` (runner + ADR), session TTL in README, SSRF allowlist in Compose/env, ownership mapping in error-handling docs if needed.
- CI: Postgres service for integration tests.
