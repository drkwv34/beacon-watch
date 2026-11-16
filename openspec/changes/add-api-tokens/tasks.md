# Tasks

## 1. Failing coverage

- [ ] 1.1 Add `apps/api/src/tokens.int.test.ts` and extend `auth.gate.test.ts` for POST/GET/DELETE `/api/v1/tokens` (session+CSRF), Bearer CRUD/check-now/checks/incidents on owned targets, 403 for another user, revoke then 401, expired/invalid 401, raw token absent from DB/list/logs, create secret not repeated, session without CSRF 403 even with fake Authorization, Bearer cannot administer tokens. Verify those route cases fail on current main with 401/404 because the routes and Bearer gate are absent.

- [ ] 1.2 Add `e2e/api-tokens.spec.ts` that creates a token in the UI, asserts the secret is shown once, and revokes it. Verify the spec fails on current main because `/dashboard/tokens` is missing.

## 2. Persistence

- [ ] 2.1 Add forward-only `packages/db/migrations/0005_api_tokens.sql` and `packages/db/src/repositories/api-tokens.ts` (insert, find by hash, list by user, revoke, touch last_used). Export from `packages/db/src/index.ts`. Verify a mapping/unit test that the public list DTO has no token or hash field.

## 3. API

- [ ] 3.1 Add AuthService Bearer resolve (domain-separated HMAC, expired/revoked → undefined) and wire `apps/api` so session wins, CSRF runs only for session, Bearer authenticates target/check/incident routes, and `/tokens` requires session. Verify 1.1 CSRF-with-fake-Authorization and Bearer-on-tokens cases.

- [ ] 3.2 Implement `apps/api/src/modules/tokens/{routes,service,schemas}.ts`: create (secret once), list (prefix+metadata), revoke. Verify 1.1 create/list/delete/lifecycle tests pass and the raw token is absent from SQL rows.

## 4. Web, docs, backlog

- [ ] 4.1 Add `/dashboard/tokens` with `token-manager.tsx` (create, one-time secret, list, revoke), nav link, empty/loading/error states. Verify 1.2 against Compose after the API is up, or skip locally only if Playwright is reserved for CI and the spec exists.

- [ ] 4.2 Document Bearer + `/api/v1/tokens` in README (curl with `$TOKEN`, no real secrets), `docs/openapi.yaml`, architecture error-handling/logging/app-conventions, and mark FR-AUTH-003 implemented in `openspec/backlog/should-scope.md`. Verify the docs do not contain a live token secret.

## 5. Integration check

- [ ] 5.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `openspec validate add-api-tokens --strict`; verify all exit 0.

## Workflow follow-up

- Archive this change after merge to `main`.
