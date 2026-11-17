# Tasks

## 1. Failing coverage

- [ ] 1.1 Extend `e2e/dashboard-smoke.spec.ts` so anonymous and forged-cookie visits to `/dashboard/targets/new` land on login without the create form; a signed-in owner can open create, see labelled fields at 375px, and get an inline URL error; nav after login has no Sign in and has Sign out; logout restores Sign in; a second user does not inherit the first user's email. Verify anonymous create currently shows the form and nav still has Sign in after login.

## 2. Session helper and pages

- [ ] 2.1 Add a `server-only` helper that loads `GET /api/v1/auth/me` via `apiFetch` (no cookie decode) and maps 401 vs outage. Verify a unit or page-level branch: 401 → unauthenticated, 503 → unavailable.
- [ ] 2.2 Guard `/dashboard/targets/new` with that helper (401 redirect, 503 panel, owner sees the form). Derive `(site)` nav from the same lookup with `force-dynamic`, and keep `/`, `/login`, and `/register` public. Verify 1.1 against the app (or Compose once web is rebuilt).

## 3. Docs

- [ ] 3.1 Note in `docs/architecture/frontend-conventions.md` that dashboard chrome and create use a validated `/me` session and must not cache nav across users. Verify the doc matches the helper.

## 4. Integration check

- [ ] 4.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `openspec validate protect-dashboard-session --strict`; verify all exit 0.

## Workflow follow-up

- Archive this change after merge to `main`.
