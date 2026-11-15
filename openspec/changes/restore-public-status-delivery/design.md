# Design

## Context

See proposal.md for motivation. Today `apps/web/src/app/s/[slug]/page.tsx` `apiFetch`es `GET /api/public/v1/status/:slug` and calls `notFound()` after that await. A sibling `loading.tsx` places a Suspense boundary between the layout and the page, so production Next can flush layout+fallback as HTTP 200 before `notFound()`. The JSON route's Redis limiter fail-closes 503, so the HTML page shows "Status temporarily unavailable" even though `docs/architecture/caching-and-rate-limits.md` already requires status HTML to read Postgres. `apps/web` currently must not import `packages/db`; this change is the documented exception for that one read.

## Goals / Non-Goals

**Goals:**

- Production `GET /s/{missing|private}` is HTTP 404 before first HTML flush.
- SSR payload comes from Postgres through a server-only reader (`is_public` AND slug, strict public DTO).
- Redis stopped: `/s/demo` 200 with real state/incidents; JSON 503.
- `DATABASE_URL` only in the web server process.

**Non-Goals:**

- Caching the HTML payload in Redis from Next.js.
- Rate-limiting `/s/[slug]` (the JSON limiter stays on `/api/public/v1` only).
- Dashboard routes reading Postgres.
- Changing Appendix A / FR-PUB-002 JSON fields.

## Decisions

### 1. Server-only reader over `packages/db`, not the public JSON API

Extract `loadPublicStatusBySlug(db, slug, now)` next to the existing public-status queries. It uses `findPublicTargetBySlug` (`public_slug = $1 AND is_public = true`) and returns `PublicStatusPayload | undefined` (never ids, URLs, owner, headers, or body). `apps/api` `PublicStatusService.loadFromDb` calls the same helper so the DTO cannot drift.

`apps/web` imports that helper from a **subpath** (`@beacon-watch/db/public-status`) so the web bundle does not load seed/argon2. The Next module is `import 'server-only'` plus React `cache()`: layout and page share one read per request. Query params, cookies, and headers MUST NOT skip `is_public`.

Rejected: keep fetching the JSON API (Redis 503 takes down HTML; the web container shares one client IP). Rejected: import `@beacon-watch/db` root (pulls native argon2 into standalone). Rejected: a client fetch to `/api/public/v1` (leaks the limiter into the browser and cannot set 404 before flush).

### 2. Existence check in the `/s/[slug]` layout, outside `loading.tsx` Suspense

`app/s/[slug]/layout.tsx` is async, `dynamic = 'force-dynamic'`, awaits `params`, calls the cached reader, and `notFound()` when the payload is missing **before rendering children**. That is outside the `loading.tsx` boundary, so the 404 status is set before any HTML flush. The page renders the already-cached payload (empty states unchanged). Postgres down: catch in the reader/page and show the existing StatePanel; do not call `notFound()`.

Rejected: only `notFound()` in the page (loses to streaming). Rejected: delete `loading.tsx` without a layout check (navigations still race). Rejected: middleware hitting the JSON API (same 503/IP problem).

Verify with `next start` / Compose production image: `curl -s -o /dev/null -w '%{http_code}'` and Playwright `request.get`.

### 3. Web config: `DATABASE_URL` server-only

Add `apps/web/src/config.ts` (Zod). `DATABASE_URL` is required to construct the reader pool; `API_BASE_URL` stays for dashboard HTTP. Compose `web` gets `DATABASE_URL` from `x-app-env` and `depends_on: db`. Never `NEXT_PUBLIC_DATABASE_URL`. Next `serverExternalPackages` includes `pg` and `@beacon-watch/db`. Pool is a module singleton in the server-only reader (`createPool`).

Rejected: passing the payload through a public env var. Rejected: a second HTTP hop to a non-rate-limited internal API (another process and contract).

### 4. Tests first, Redis restored in `finally`

Red on current main:

- Playwright (or curl against Compose web) missing slug → expect 404; today 200.
- Isolated e2e: `docker compose stop redis`, `GET /s/demo` expect 200 + labelled status/incidents, JSON expect 503; `finally` starts Redis and waits healthy. Today HTML is unavailable/503-driven.

DB integration: loader returns payload for public slugs, `undefined` for private/unknown, and JSON of the DTO has no `id`/`url`/owner. Config unit test: schema reads `DATABASE_URL`, rejects `NEXT_PUBLIC_DATABASE_URL` as the source.

## Risks / Trade-offs

- [Standalone image missing `pg`] → `serverExternalPackages` + Compose rebuild of `web`; trace in the image before PR.
- [Layout await slows TTFB vs streaming skeleton] → accepted; 404 correctness beats an early 200. `loading.tsx` still covers client navigations after the layout resolves.
- [Web holds a Postgres pool] → read-only public queries, statement timeout 5s, max 10; dashboard still uses the API.
- [Two readers if API helper is not reused] → API `loadFromDb` must call the shared db helper in the same PR.

## Migration Plan

1. Ship web + db together: old web without `DATABASE_URL` would 500 on `/s/*` after the reader lands; Compose always injects it.
2. Rollback: previous web image (JSON SSR) plus omit `DATABASE_URL` on `web`. No schema change.
3. No data migration.

## Open Questions

None.
