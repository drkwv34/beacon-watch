# AGENTS.md

Guidance for coding agents (Cursor, Composer) working in this repo.

1. Read `docs/architecture/README.md`, then the topic docs for the area you are touching. They are normative.
2. Cursor rules live in `.cursor/rules/` (one always-on gate plus scoped rules for `api`, `worker`, `domain`, `db`, `web`).
3. Product behavior changes require an approved OpenSpec change under `openspec/changes/` (`openspec/README.md`).
4. Before pushing, run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. Validate Compose with `pnpm compose:config` when touching `docker-compose.yml`, Dockerfiles, or env vars.
6. Conventional commits, one logical change per commit, no secrets, no AI co-author trailers.
