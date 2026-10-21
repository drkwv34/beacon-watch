# Tasks

## 1. OpenSpec planning

- [x] 1.1 Create change `add-pin-ready-closeout` with proposal, skipped specs (`skip_specs: true`), design, and this task list; verify `openspec status --change add-pin-ready-closeout` shows proposal/design/tasks done and specs skipped

## 2. Must-scope triage and docs hygiene

- [x] 2.1 Triage leftover Must bugs (GitHub issues, latest CI on main, SRS Must vs shipped specs, `TODO`/`FIXME` in product code); record findings in `docs/pin-ready-checklist.md` and fix only small real defects if found (verify: `gh issue list --state open` is empty or listed, and any code fix has a test or command)
- [x] 2.2 Rewrite `openspec/specs/README.md` so it indexes shipped capabilities instead of claiming the folder is empty; verify the file lists `auth`, `targets`, `scheduling`, `probe`, `incidents`, `caching`, `public-api`, `dashboard-ui`, `quality`, and `portfolio`
- [x] 2.3 Update `openspec/project.md` so Day 9 pin-ready closeout is marked and FR-AUTH-003 / NFR-OBS-002 remain labelled Should; verify the capability table still describes current behaviour only

## 3. Should-scope backlog (do not implement)

- [x] 3.1 Add `openspec/backlog/should-scope.md` listing FR-AUTH-003 API tokens, NFR-OBS-002 `/metrics`, latency sparkline, alerts, hosted deploy, ICMP, soak history, and NFR-PERF-001 as a CI gate as proposal-only; verify the file states explicitly that none of these are implemented in this change

## 4. Quality-bar checklist

- [x] 4.1 Commit `docs/pin-ready-checklist.md` with every portfolio quality-bar item marked met / not met plus evidence (path, CI run URL, or command); verify About/topics is **not met (manual, owner sets in GitHub Settings)** and that the GitHub About API was not called
- [x] 4.2 Confirm the checklist names Compose `--wait` + `pnpm seed` + `scripts/demo-flap.sh`, the Playwright e2e job, NFR-PORT-001, MIT LICENSE, OpenSpec skills/commands/archive, and `.cursor/rules/`; verify those rows exist

## 5. Validation

- [x] 5.1 Run `openspec validate add-pin-ready-closeout --strict` and `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config`; verify all exit 0

## Workflow follow-up

- Open a ready (non-draft) PR to `main` from `chore/pin-ready`.
- Wait for CI on the PR head; fix and push if it fails; merge only when green, including Playwright e2e and NFR-PORT-001. A concurrency-cancelled run on the merge commit is not a failure; judge the PR head.
- Merge locally as Christian Agila: `git checkout main && git pull && git merge --no-ff chore/pin-ready -m "Merge pull request #<n> from drkwv34/chore/pin-ready" && git push origin main`. Never use the GitHub merge button or API.
- After merge, archive on `main` as Christian Agila: `openspec archive add-pin-ready-closeout --yes` (add `--skip-specs` if the CLI still requests a spec sync).
- Confirm CI on `main`; optionally annotated-tag `v0.1.0`.
