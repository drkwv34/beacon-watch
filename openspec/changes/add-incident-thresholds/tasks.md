# Tasks

## 1. Domain

- [ ] 1.1 Add `IncidentId`, `INCIDENT_STATUSES` (`open` | `resolved`), and pure `applyCheckResult` in `packages/domain/src/incidents/`; verify unit tests replay the Appendix B worked example (fail, fail → open; success; fail; success, success → resolve) plus grace=3 and counter reset on the opposite outcome

## 2. Persistence

- [ ] 2.1 Write forward-only `0003_incidents.sql` (`incidents` table, resolved_at iff resolved, FK `ON DELETE CASCADE`, partial unique open index, `(target_id, opened_at DESC)`); verify the file is new SQL and `updateTargetAfterCheck` can persist consecutive counters
- [ ] 2.2 Add incidents repository (`insertOpenIncident`, `findOpenIncident`, `resolveIncident`, `listIncidentsForTarget`) that maps unique-open violations to a no-op; verify mapping tests plus a Postgres unique-index / lock test that two concurrent opens cannot both succeed

## 3. Worker

- [ ] 3.1 In the check persist transaction, lock the target, insert the check, apply `applyCheckResult`, update counters and `last_status`, then open or resolve; verify integration: fail,success → no incident; fail,fail → one open and last_status down; success,success → resolved and last_status up; two concurrent persist workers → one open incident

## 4. Timeline API

- [ ] 4.1 Add session-authenticated `GET /api/v1/targets/:id/incidents` returning `{ items }` newest first with `status`, `opened_at`, `resolved_at`, `trigger_check_id`, and `duration_seconds`; verify API tests: open and resolved durations, 404 for a non-owner and unknown id (auth gate remains `/api/v1/__probe`)

## 5. Integration check

- [ ] 5.1 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-incident-thresholds --strict`; verify all exit 0

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head, merge locally with `--no-ff`, then `openspec archive add-incident-thresholds --yes`.
