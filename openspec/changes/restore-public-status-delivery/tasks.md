# Tasks

## 1. Failing regression coverage

- [ ] 1.1 Add Playwright coverage that `GET /s/{missing}` and a private slug against the Compose production web image return HTTP 404 (same not-found body, no ids/URLs). Verify the missing-slug case fails on current main because the status is 200.
- [ ] 1.2 Add an isolated Playwright Redis-outage spec: stop Compose Redis, assert `GET /s/demo` is 200 with labelled status and incidents, assert `GET /api/public/v1/status/demo` is 503, start Redis in `finally` and wait until healthy. Verify `/s/demo` fails on current main (unavailable copy or non-200 data).

## 2. Shared public payload and web reader

- [ ] 2.1 Add `loadPublicStatusBySlug` in `packages/db` (subpath `@beacon-watch/db/public-status`) using `findPublicTargetBySlug` and the strict `PublicStatusPayload` DTO; point API `loadFromDb` at it. Verify a Postgres test: public slug returns payload, private/unknown are undefined, serialized DTO has no id/url/owner.
- [ ] 2.2 Add web Zod `config.ts` for `DATABASE_URL` (never `NEXT_PUBLIC_*`), a `server-only` reader with a module pool, Compose `web` `DATABASE_URL` + `depends_on: db`, and Next `serverExternalPackages` for `pg`/`@beacon-watch/db`. Verify config tests and `pnpm compose:config`.

## 3. HTTP 404 before first flush

- [ ] 3.1 Make `/s/[slug]` layout async and `force-dynamic`, resolve the cached reader, and call `notFound()` before children so `loading.tsx` cannot flush 200. Page renders the cached payload (or StatePanel on Postgres failure). Verify 1.1 is green on a production build via curl and Playwright.

## 4. Docs

- [ ] 4.1 Document the SSR `apps/web` → `packages/db` exception (is_public filter, strict DTO, `DATABASE_URL` server-only) in architecture README/layering/frontend/caching/testing, README hard edges, and the web cursor rule. Verify the docs match the implemented reader and Redis-down split.

## Workflow follow-up

- Archive this change after merge to `main`.
