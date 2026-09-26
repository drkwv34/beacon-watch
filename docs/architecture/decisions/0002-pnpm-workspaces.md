# ADR 0002: pnpm workspaces, source-first internal packages

- Status: accepted (2026-09-26)
- Source: SRS §11 open question 1

## Decision

- pnpm workspaces (`apps/*`, `packages/*`, `mock-target`) with one committed lockfile; pnpm version pinned via `packageManager`.
- Internal packages publish `dist` for production but expose `src` via the custom export condition `@beacon-watch/source`,
  enabled in `tsconfig.base.json` (`customConditions`), Vitest (`resolve.conditions`), and `tsx --conditions`.
- Docker images use `pnpm deploy --prod` per app for a minimal runtime tree; Next.js uses `output: 'standalone'`.

## Consequences

- Typecheck, tests, and dev servers work without building packages first; `pnpm build` runs in topological order.
- No Turborepo/Nx for now; `pnpm -r` is enough at this size. Revisit if CI time exceeds ~5 minutes.
