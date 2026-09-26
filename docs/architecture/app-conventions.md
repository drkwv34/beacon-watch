# App conventions

## Configuration (SRS §8.5)

- Each app has one `src/config.ts` that parses `process.env` with **Zod** at boot and exits on failure, listing invalid keys only.
- `process.env` is read nowhere else. Config is passed into constructors, not imported globally.
- Every variable is documented in `.env.example` with a safe placeholder. New variable = update `.env.example` + `docker-compose.yml` in the same PR.
- Booleans are the literal strings `true`/`false`; numbers are coerced and range-checked.

## Security baseline

- No secrets in git, ever. `.env*` is gitignored except `.env.example`, which only holds local placeholders.
- Sessions: HttpOnly, `Secure` outside local dev, `SameSite=Lax`, CSRF token on mutating routes (Day 2).
- Authorization in the service layer: every target query is scoped by `user_id`; public routes select by `public_slug AND is_public`.
- Public endpoints never expose internal ids of private targets (NFR-SEC-001).
- Compose publishes ports on `127.0.0.1` only.

## API style

- Authenticated JSON under `/api/v1`, public JSON under `/api/public/v1`, ops at `/healthz` and `/readyz`.
- `snake_case` JSON fields (matches the SRS payloads); timestamps ISO-8601 UTC.
- Request bodies validated with Zod schemas in `schemas.ts` next to the route.
- Lists are paginated with `limit` (default 50, max 200) and a cursor.

## Tooling

- **pnpm workspaces** with a committed `pnpm-lock.yaml`; version pinned via `packageManager` (ADR 0002). Node 22 (`.nvmrc`).
- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. ESM everywhere.
- Internal packages expose `src` through the `@beacon-watch/source` export condition for typecheck, tests, and `tsx` dev; production imports `dist`.
- Formatting: Prettier. Linting: ESLint flat config with architecture boundary rules.

## Git

- Conventional commits (`feat(worker): claim due targets with SKIP LOCKED`), one logical change per commit.
- One branch per theme (`chore/scaffold`, `feat/auth-targets`, …), merged via PR when CI is green.
- Author and committer: Christian Agila. No AI co-author trailers.
- Never rewrite published history.
