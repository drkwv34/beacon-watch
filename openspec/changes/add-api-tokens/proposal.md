# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-16 |
| Capabilities | auth, dashboard-ui |
| FR / NFR IDs | FR-AUTH-003, FR-AUTH-002, NFR-SEC-001, FR-ERR-003 |

## Why

Auth is email/password plus Postgres sessions only. FR-AUTH-003 (opaque, revocable management tokens) was recorded as Should and deferred in `openspec/backlog/should-scope.md`. Owners need a Bearer credential for target, check, and incident APIs without sending the session cookie. This change implements that capability rather than leaving it on the backlog.

## What Changes

- Opaque random API tokens (not JWT). Store only a domain-separated hash, a public prefix, label, and created/expires/revoked metadata. The full secret is returned **once** on create.
- Session + CSRF management: `POST/GET/DELETE /api/v1/tokens`. Bearer MUST NOT create, list, or revoke tokens. Bearer MUST NOT login or logout.
- `Authorization: Bearer` authenticates the token owner for target CRUD, check-now, checks list, and incident timeline, with the same ownership mapping (403/404). Invalid, expired, or revoked tokens are 401.
- CSRF is omitted **only** when the request actually authenticated with a valid Bearer token. A cookie session still requires CSRF even if an `Authorization` header is present (including a fake one).
- Dashboard page to create, list (prefix + metadata, never the secret), and revoke tokens, plus a README curl example that does not log secrets.
- Remove FR-AUTH-003 from the Should-only backlog note so it is no longer listed as unimplemented.
- No **BREAKING** change to existing cookie-session clients. FR-AUTH-002 expands: protected `/api/v1` routes accept a valid session **or** a valid Bearer token (register/login remain public).

Out of scope: OAuth, JWT, scoped tokens, Christian's personal credentials, Prometheus metrics, other Should-backlog items.

## Capabilities

### New Capabilities

- None. Tokens belong to `auth`.

### Modified Capabilities

- `auth`: FR-AUTH-003 management tokens; FR-AUTH-002 accepts session or Bearer on protected routes; CSRF skip is Bearer-auth only.
- `dashboard-ui`: owner UI to create, list, and revoke tokens; secret shown once.

## Impact

- Code: `apps/api` auth gate + tokens module, `packages/db` migration `0005_api_tokens.sql` and repository, `apps/web` `/dashboard/tokens`, Playwright e2e.
- APIs: `/api/v1/tokens`; Bearer on existing target/check/incident routes.
- Schema: `api_tokens` table (hash unique, FK user, revoked_at).
- Config: reuse `SESSION_SECRET` for HMAC domain separation; no new env var.
- Docs: README, architecture (sessions/CSRF/Bearer, logging redaction), OpenAPI, `openspec/backlog/should-scope.md`, `openspec/specs/README.md` / `project.md` on archive.
