# Design

## Context

See proposal.md. `buildApp` authenticates `/api/v1` only via `resolveSession` on the `beacon_session` cookie, then `assertCsrf` on mutations. `AuthService` persists sessions only. There is no tokens table, route, or UI. Session tokens are HMAC-SHA256(`SESSION_SECRET`, raw). CSRF is double-submit (`beacon_csrf` + `x-csrf-token`).

## Goals / Non-Goals

**Goals:**

- Opaque revocable tokens hashed with domain separation so a session-hash dump cannot be replayed as an API token.
- Session+CSRF for token administration; Bearer for owner target/check/incident APIs only.
- CSRF skip tied to successful Bearer authentication, not the presence of `Authorization`.

**Non-Goals:**

- JWT, OAuth, per-route scopes, refresh tokens, new env secrets, logging the raw token, Bearer login/logout.

## Decisions

### 1. Token format and hashing

Format `bw_<8-char-prefix>_<secret>` where prefix is 6 random bytes base64url and secret is 32 random bytes base64url. Persist `token_hash = HMAC-SHA256(SESSION_SECRET, "beacon-watch:api-token:" || token)`, `prefix`, `label`, `user_id`, `created_at`, optional `expires_at`, `revoked_at`, `last_used_at`. Rejected: JWT (external alg surface, not immediately revocable in DB), hashing with the same context as sessions (cross-use of a leaked hash).

Reuse `SESSION_SECRET` (already ≥32). Inject `randomBytes` like sessions. Prefix is display-only and not sufficient to authenticate.

### 2. Auth gate order

On protected `/api/v1`:

1. If the session cookie resolves, set `authUser` and `authMethod = 'session'`.
2. Else parse `Authorization: Bearer <token>`, look up hash, reject missing/expired/revoked as 401, set `authUser` and `authMethod = 'bearer'`, touch `last_used_at`.
3. Else 401.

CSRF runs only when `authMethod === 'session'`. A fake `Authorization` header does not skip CSRF. Token routes (`/tokens*`) require `authMethod === 'session'` (403 for Bearer). Logout remains session-only: Bearer POST `/auth/logout` is 403.

### 3. Persistence

Forward-only `0005_api_tokens.sql`: `api_tokens` with unique `token_hash`, index on `user_id`, FK `users(id) ON DELETE CASCADE`, check that `revoked_at` is null or `expires_at` is null-or-timestamptz. Label 1–100 chars at the service/Zod layer.

Create, list, and revoke each use one transaction (or a single statement). No network IO in those transactions. Hashing is local crypto.

### 4. HTTP shapes (snake_case)

- `POST /api/v1/tokens` `{ label, expires_at? }` → 201 `{ id, label, prefix, token, created_at, expires_at }`
- `GET /api/v1/tokens` → `{ items: [{ id, label, prefix, created_at, expires_at, last_used_at }] }` (non-revoked)
- `DELETE /api/v1/tokens/:id` → 204; unknown or other-user id → 404 (do not leak other users' token ids as 403; tokens are not shared resources like targets). Owner of a already-revoked id → 404.

### 5. Logging

Keep `REDACT_PATHS` on `authorization` and cookies. Never log the create body token, prefix+secret concatenation, or query strings. Tests assert the raw token is absent from DB rows, list JSON, and captured log output.

### 6. Web

`/dashboard/tokens` server page + client `TokenManager`: create form (label, optional expiry), one-time secret panel (`role="status"`), list table/cards, revoke with confirm. Empty/loading/error states. Nav link from the dashboard header. Playwright covers create-once and revoke.

### 7. Docs

README session paragraph plus a curl example using `$TOKEN` (never a real secret). `docs/openapi.yaml` documents Bearer and `/tokens` plus the owner routes that accept it. Error-handling notes Bearer 401 vs owner 403. Backlog: FR-AUTH-003 is implemented, not Should-only.

## Risks / Trade-offs

- [HMAC with SESSION_SECRET] → domain-separated context string; rotating the secret invalidates sessions and tokens together (acceptable before production users).
- [403 on Bearer token admin] → makes automated token rotation require a session; accepted (tokens must not mint tokens).
- [last_used_at write on each Bearer request] → one indexed UPDATE; skip if already revoked/expired.
- [Token id 404 for other users] → avoids confirming foreign token ids; targets still use 403 because their ids appear in the owner's dashboard.

## Migration Plan

API/web boot already runs pending SQL. Empty volumes apply `0005`. No down migration; rollback is a new forward file plus code revert.

## Open Questions

None.
