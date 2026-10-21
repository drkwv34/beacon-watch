# Proposal

| Field | Value |
| --- | --- |
| Status | approved |
| Approved by / on | Christian Agila / 2026-10-20 |
| Capabilities | none (`skip_specs: true`) |
| FR / NFR IDs | NFR-PORT-001, NFR-MAINT-001 (evidence only); leftover Must FRs already specified under `openspec/specs/` |

## Why

beacon-watch is at the final pin-ready closeout (Day 9). Reviewers need evidence that Must-scope product work is complete, leftover Must bugs are triaged, Should-scope items are recorded without being implemented, and every portfolio quality-bar item is marked met or not met with file/CI/command evidence.

## What Changes

- Triage leftover **Must** bugs only (SRS Must FRs not met, open GitHub issues, failing or flaky checks, obvious `TODO`/`FIXME` in product code). Fix small real defects; list anything deferred with a reason. No new product features and no Should-scope builds.
- Commit `docs/pin-ready-checklist.md` covering every portfolio quality-bar item with **met** / **not met** plus evidence (file path, CI run URL, or command).
- Record Should-scope items as a standing OpenSpec backlog note under `openspec/backlog/should-scope.md` (proposal-only; do **not** implement them).
- Do **not** call the GitHub API to set About/topics (known 403). Record **not met (manual, owner sets in GitHub Settings)** with the intended blurb and topics already listed in the README metadata section.
- Optional annotated tag `v0.1.0` on the merged `main` commit (GitHub release only if the API allows it without permission loops).
- Keep `main` green after merge; archive this change on `main` with the Fission-AI OpenSpec CLI.

No **BREAKING** API or schema changes are planned. Product capabilities already specified under `openspec/specs/` stay as-is unless a Must-scope defect requires a tiny fix that does not change requirements.

## Capabilities

### New Capabilities

- _(none — this change is pin-ready closeout documentation and triage, not a new product capability)_

### Modified Capabilities

- _(none — no spec-level product behavior changes; Should items stay unimplemented)_

This change sets `skip_specs: true` in `.openspec.yaml` because it is docs/process closeout: a quality-bar checklist, a Should-scope backlog note, and Must-only defect triage. Inventing a `pin-ready` product spec would not describe system behavior.

## Impact

- `docs/pin-ready-checklist.md` (new)
- `openspec/backlog/should-scope.md` (new standing backlog; not a spec)
- Possibly small Must-scope docs hygiene (`openspec/specs/README.md` still says the specs folder is empty after Days 2–8 shipped)
- `openspec/project.md` Day 9 closeout note
- Optional `v0.1.0` tag after merge
- No Should-scope implementation, no alerts integrations, no hosted deployment, no semaphore-flags / kickoff-club / courier-outbox / profile-readme work, no About/topics API calls, no history rewrite

## Out of scope

- New beacon-watch product features beyond Must triage.
- Should-scope builds (API tokens, Prometheus `/metrics`, latency sparkline, alerts, hosted deploy, ICMP, soak history).
- Semaphore-flags / kickoff-club / courier-outbox / profile-readme work.
- Setting GitHub About/topics via API.
- Deleting, skipping, or loosening a CI job.
- History rewrite or `Co-authored-by` trailers.
