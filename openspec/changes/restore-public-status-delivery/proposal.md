# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-11-15 |
| Capabilities | dashboard-ui, caching, quality |
| FR / NFR IDs | FR-PUB-001, FR-PUB-002, FR-CACHE-003, NFR-REL-001, NFR-SEC-001, NFR-MAINT-001 |

## Why

`GET /s/[slug]` streams HTML before it knows whether the slug is public, so missing and private pages return HTTP 200 with a not-found body. The same route loads the public JSON API, so a Redis outage fail-closes the HTML page with 503/unavailable even though Postgres still holds the payload and NFR-REL-001 requires status HTML to stay up.

## What Changes

- Resolve public-slug existence (`public_slug` + `is_public`) in the Next.js server tree **before the first HTML flush**, so missing, private, and slugless targets return a real HTTP **404** with the existing not-found UI and no ids, URLs, or owner data.
- Server-render `/s/[slug]` from a **server-only** reader over `packages/db` that returns the strict public DTO (Appendix A plus FR-PUB-002 fields). `DATABASE_URL` is web-server config only (never `NEXT_PUBLIC_*`). There is no client-controllable bypass of the `is_public` filter.
- When Redis is stopped, `GET /s/demo` returns **200** with real state and incidents from Postgres; `GET /api/public/v1/status/:slug` stays fail-closed **503**.
- Document this SSR read as the one allowed `apps/web` → `packages/db` exception in architecture docs and the README.
- Land deterministic regression tests first (HTTP 404 on a production build; isolated Redis-outage HTML vs JSON with Redis restored in `finally`).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dashboard-ui`: public HTML is SSR from the server-only Postgres reader, not the public JSON API; unknown/private slugs are HTTP 404 before first flush; Redis-down HTML stays up.
- `caching`: status HTML degrades to Postgres when Redis is down; the public JSON limiter remains fail-closed 503.
- `quality`: production-build 404 coverage and an isolated Redis-outage e2e that restores Redis in `finally`.

## Impact

- Code: `apps/web` server-only reader + `/s/[slug]` layout/page, `packages/db` public payload loader, web Zod config, Compose `web` `DATABASE_URL`.
- APIs: public JSON contract unchanged (still 404 private/unknown, 503 without Redis). HTML status codes for missing slugs change from 200 to **404**.
- Schema: none.
- Config: web process reads `DATABASE_URL` (already in `.env.example`; add to the Compose `web` service). Never `NEXT_PUBLIC_DATABASE_URL`.
- Conventions: `docs/architecture/README.md`, layering, frontend, caching, testing, README, web cursor rule.
- Out of scope: other findings; changing the JSON limiter; client-side status fetches; dashboard data still over HTTP.
