# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-17 |
| Capabilities | dashboard-ui |
| FR / NFR IDs | FR-AUTH-002, FR-UI-003, NFR-SEC-001, NFR-A11Y-001 |

## Why

`/dashboard/targets/new` is a static page with no session check, so an anonymous visitor or a forged cookie still receives the create form. The site header always renders a Sign in link, so a signed-in owner still sees Sign in and the shell can be cached across users. Dashboard data already validates the session through the API; create and nav must do the same via `GET /api/v1/auth/me` instead of decoding cookies in Next.js.

## What Changes

- Guard `/dashboard/targets/new` on the server with a validated session (`GET /api/v1/auth/me` through the existing cookie-forwarding helper). **401** redirects to `/login` without rendering the create form. **503** (and other outages) is a distinct error panel, not a login redirect.
- Derive the site nav from that same session lookup: signed-in owners do not see Sign in; after logout Sign in returns. Marketing, login, and register stay reachable without a session.
- Do not cache one user's nav for another (`force-dynamic` / no-store on the session read).
- Keep create-form inline validation, labelled fields, and a 375px-usable layout.
- No **BREAKING** API change. Out of scope: public JSON limiter, HTML `/s/[slug]`, Bearer token UI beyond existing links.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dashboard-ui`: create monitor requires a validated session; site nav is derived from `/me` and is not cross-user cached.

## Impact

- Code: `apps/web` session helper, `(site)/layout.tsx`, `/dashboard/targets/new`, dashboard page, Playwright `e2e/dashboard-smoke.spec.ts`.
- APIs: none; reuses `GET /api/v1/auth/me`.
- Schema: none.
- Config: none.
- Docs: frontend conventions note that dashboard chrome uses the validated session.
- Out of scope: public rate limits, other dashboard routes beyond nav/create, decoding session tokens in the web app.
