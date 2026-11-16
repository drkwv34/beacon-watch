# Tasks

## 1. Failing regression coverage

- [x] 1.1 Expand `apps/api/src/incidents.int.test.ts` so session B on target A expects 403 FORBIDDEN with `request_id` and no timeline items, a well-formed missing UUID is 404, the owner is 200, no session is 401, and a non-UUID id is 400. Verify the non-owner case fails on current main because the status is 404.

## 2. Ownership mapping

- [x] 2.1 Extract `loadOwnedTarget` in `apps/api/src/modules/targets/ownership.ts` (invalid UUID → VALIDATION_FAILED, missing → NOT_FOUND, other user → FORBIDDEN) and use it from targets, checks, and incidents. Verify the 1.1 non-owner assertion is 403 and the owner/missing/unauth/invalid cases stay green.

- [x] 2.2 Document authenticated incident 403 vs 404 next to targets/checks in `docs/architecture/error-handling.md`. Verify the doc names the incidents route and still says public routes use 404 for private.

## 3. Integration check

- [x] 3.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `openspec validate align-incident-authorization --strict`; verify all exit 0.

## Workflow follow-up

- Archive this change after merge to `main`.
