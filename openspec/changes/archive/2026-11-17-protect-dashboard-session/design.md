# Design

## Context

See proposal.md. `apps/web/src/app/(site)/dashboard/targets/new/page.tsx` is a server component that always renders `TargetForm`. `(site)/layout.tsx` hardcodes a Sign in link. `lib/session.ts` `apiFetch` already forwards cookies with `cache: 'no-store'`. Dashboard list and target detail already treat `/api/v1` 401 as `redirect('/login')`. `GET /api/v1/auth/me` is the existing session probe. Marketing `/`, `/login`, and `/register` must stay public.

## Goals / Non-Goals

**Goals:**

- Server-side session gate on create; 401 vs 503 distinguished.
- Nav from the same `/me` lookup; no Sign in while authenticated; restored after logout; no cross-user cache.
- Keep inline validation and 375px layout.

**Non-Goals:**

- Decoding `beacon_session` in Next.js.
- Middleware that hits Redis or Postgres from the web process.
- Changing TargetForm field set or API create contract.

## Decisions

### 1. Reuse `/me` through a server-only helper

Add `apps/web/src/lib/dashboard-session.ts` (`import 'server-only'`) that calls `apiFetch('/api/v1/auth/me')` and returns `{ state: 'authenticated', user } | { state: 'unauthenticated' } | { state: 'unavailable', status, requestId }`. `requireDashboardSession()` redirects on unauthenticated and returns the outage/authenticated result to the page. Rejected: JWT parse in the web app (duplicates API session rules). Rejected: a new web-only cookie.

### 2. Layout loads session; pages decide redirects

`(site)/layout.tsx` is `dynamic = 'force-dynamic'`, loads the session, and renders nav: Dashboard, API tokens, then Sign in **or** email + Sign out. 503 on `/me` omits Sign in/Sign out and does not pretend the user is anonymous. Create page calls `requireDashboardSession()` so 401 cannot stream the form. Dashboard list can share the helper for 401/503 consistency. Rejected: client-only nav (would flash Sign in). Rejected: Full Route Cache of the shell (cross-user leak).

### 3. Tests in Playwright against Compose

Extend `e2e/dashboard-smoke.spec.ts`: anonymous and forged cookie to `/dashboard/targets/new` → login, no Name field; owner create still works with inline URL error; after login nav has no Sign in; after logout Sign in returns; two sequential users do not share email in nav; a 375px viewport still shows labelled create fields. Capture red on current main (create form is public; Sign in remains after login — the existing smoke even clicks it).

## Risks / Trade-offs

- [Extra `/me` per document] → one no-store fetch in the layout; create/dashboard may call `/me` again; accepted vs stale nav.
- [503 vs missing API] → treat any non-401 failure as unavailable so a down API does not bounce owners to login.
- [Email in nav] → needed to prove no cross-user cache; keep styling on existing tokens (`.muted`).

## Migration Plan

No schema. Rollback is revert of the web files.

## Open Questions

None.
