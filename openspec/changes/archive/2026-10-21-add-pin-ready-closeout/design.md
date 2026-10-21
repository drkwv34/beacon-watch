# Design

## Context

See `proposal.md` for motivation. beacon-watch on `main` (`1e1ab0c`) already ships Must-scope product (auth/targets, scheduler/probes, incidents, cache/public API, dashboard/`/s/[slug]`, CI pyramid, Appendix D seed + NFR-PORT-001 flap demo). GitHub has **zero issues**. Latest `CI` run on `main` (workflow run `39354046009`) succeeded on `1e1ab0c`, including Playwright smoke and the flap spec. Product packages stay untouched unless triage finds a small Must defect.

Constraints: domain stays pure; probes stay in `apps/worker/src/probe/`; never skip or loosen CI; never rewrite history; never call the GitHub About/topics API; author and committer are Christian Agila with zero `Co-authored-by` lines.

## Goals / Non-Goals

**Goals:**

- Evidence-first closeout: every quality-bar item in `docs/pin-ready-checklist.md` is **met** or **not met** with a concrete path, CI run URL, or command.
- Standing Should-scope backlog under `openspec/backlog/` that survives archive (not only this change’s proposal).
- Honest triage: if nothing Must-scope is broken, say so; still fix tiny docs inaccuracies that would fail the quality bar (`openspec/specs/README.md` still claims the specs folder is empty).

**Non-Goals:**

- Spec deltas for product capabilities (this change uses `skip_specs: true`).
- Implementing any Should item, alerts, hosted deploy, or work in other repos.
- Rewriting the README, Compose, Playwright, or CI unless a Must defect is proven.
- Calling the GitHub API to set About/topics.

## Decisions

### 1. Skip spec deltas

- **Choice:** `skip_specs: true`. Closeout docs are not product behavior; inventing a `pin-ready` capability would fail the “durable system behavior” rule.
- **Alternative:** Add a `pin-ready` spec. Rejected — `openspec validate` would then require SHALL/WHEN/THEN for a checklist file, which is process not product. Same pattern as courier-outbox Day 9 and `restore-e2e-ci` in this repo.

### 2. Standing backlog path

- **Choice:** `openspec/backlog/should-scope.md` (proposal-only note; no tasks to implement). Archive moves the change folder but this file stays in-tree.
- **Alternative:** Only list Should items in this change’s `proposal.md`. Rejected — archive would bury the only backlog record.

### 3. Quality-bar evidence format

- **Choice:** Markdown tables with columns: item, status (`met` / `not met`), evidence. About/topics: do **not** call the API (Day 9 brief: known 403). Mark **not met (manual, owner sets in GitHub Settings)** with the intended blurb and topics already in `README.md` § Repository metadata.
- **Alternative:** One `gh repo edit` attempt like courier-outbox/kickoff-club. Rejected — this brief forbids the call.
- **Alternative:** Claim About is met because README already lists the blurb. Rejected — the bar is the GitHub repository metadata, not a README fallback.

### 4. Tiny Must-scope docs hygiene (not features)

- **Choice:** Rewrite `openspec/specs/README.md` so it indexes shipped capabilities instead of saying the folder is empty. Add a Day 9 closeout line to `openspec/project.md`.
- **Alternative:** Leave them stale. Rejected — “rules + agentic docs first” and an honest architecture/OpenSpec section would be weaker evidence.

### 5. Deferred Must vs Should

- **Choice:** FR-AUTH-003 (API tokens), NFR-OBS-002 (`/metrics`), latency sparkline, alerts, hosted deploy, ICMP, soak history, and NFR-PERF-001 as a CI gate stay Should. Cache/limiter/incident Musts are already specified and tested. NFR-PERF-001 has a local bench (`scripts/bench-public-status.ts`) that Day 5 design explicitly kept out of CI.
- **Alternative:** Treat any of those as leftover Musts and implement them. Rejected — archived proposals marked them Should or out of MVP; implementing them is Should-scope.

### 6. Tag and merge order

- **Choice:** Open a ready PR from `chore/pin-ready`. Merge only after all CI jobs succeed on the PR head (including Playwright and NFR-PORT-001). Merge locally as Christian Agila with `git merge --no-ff` (never the GitHub merge button/API). Archive on `main` as a direct commit (`openspec archive add-pin-ready-closeout --yes`; `--skip-specs` because skip_specs is already declared). Optional annotated `v0.1.0` on the post-archive `main` SHA if tagging is allowed.
- **Alternative:** Tag the PR head. Rejected — pin version should point at merged `main`.

## Risks / Trade-offs

- [GitHub About PATCH would 403] → Do not call it; record **not met (manual)** in the checklist.
- [No Must bugs exist] → Checklist triage section states “none found”; do not invent product work.
- [Co-author hook reintroduces trailers] → Local `commit-msg.cursor.co-author` is a no-op; verify every commit message before push.
- [Archive `--skip-specs` vs `--yes` only] → Prefer `--yes` first; add `--skip-specs` if the CLI still wants a spec sync that skip_specs already declined.
- [Concurrency-cancelled CI on the merge commit] → Judge the PR head, not the cancelled merge run.

## Migration Plan

Not applicable (no schema or API migration). Rollback is revert of the closeout commits on `main`.

## Open Questions

None that affect approach or tasks. Tag `v0.1.0` is optional per the Day 9 brief; attempt after archive if `git`/`gh` allow it.
