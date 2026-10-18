# Tasks

## 1. Domain and public payload helpers

- [ ] 1.1 Add `selectPublicStatusNotice` (paused → paused, check_count 0 → starting, else !ever_succeeded → never_succeeded) plus public copy constants; verify unit tests for those three states and the happy path (`null`)
- [ ] 1.2 Extend `PublicStatusPayload` with `check_count`, `ever_succeeded`, and `recent_incidents` (no ids); verify TypeScript compile and existing cache wrap/unwrap tests still pass

## 2. Persistence and owner APIs

- [ ] 2.1 Add latest-latency-by-ids, limited `listChecksForTarget`, `countSuccessfulChecksForTarget` (or equivalent), and `setNextCheckAt`; verify repository/unit mapping tests
- [ ] 2.2 Add `GET /api/v1/targets/:id/checks` and include `latency_ms` on list/get JSON; verify owner 200 newest-first, 401, 403 other user, 404 unknown id
- [ ] 2.3 Add `POST /api/v1/targets/:id/check-now` that only sets `next_check_at = now()`; verify 200 for owner, 403 other user, 404 unknown, 401 unauthenticated, and no outbound HTTP
- [ ] 2.4 Return additive public JSON fields from `PublicStatusService` and extend `PublicStatusBody`; verify no-checks / never-succeeded / recent-incidents cases and that private/unknown 404 bodies still match aside from request_id

## 3. Dashboard UI

- [ ] 3.1 Split layouts with a `(site)` group vs brand-only `/s` chrome; verify skip link + main remain and `/s` has no dashboard nav
- [ ] 3.2 Upgrade the target list (table/cards, `StatusBadge` text labels, latency, last-checked, empty StatePanel + CTA "Add your first monitor."); verify unit/component tests for badge mapping and empty-state selection
- [ ] 3.3 Add target detail: checks table, incident timeline (open highlighted), edit form with pause/resume and delete confirmation, Check now; verify keyboard-labelled form and pending disable
- [ ] 3.4 Expand the create form to SRS §3.2 fields with inline `details.fields` errors, 409 on slug, focus first invalid field; verify those error mappings in a component or unit test

## 4. Public status page and demo flap

- [ ] 4.1 Add `/s/[slug]` SSR from the public API with 404 for private/unknown and "Status temporarily unavailable" on 429/503; verify FR-PUB-002 copy selection and not-found.tsx
- [ ] 4.2 Add mock-target `/admin/fail` and `/admin/ok` plus `scripts/demo-flap.sh`; verify `/health` flips to 500 then back to 200
- [ ] 4.3 Document the dashboard and `/s/[slug]` demo path in the README run section; verify the commands in that section still match Compose ports

## 5. Playwright and integration check

- [ ] 5.1 Add a Playwright smoke against the real stack (register, create mock-target URL, see list, open public page) that does not trip the public limiter; capture screenshots of list, detail, public green, and public red after flap
- [ ] 5.2 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm compose:config` and `openspec validate add-ui-status-dashboard --strict`; verify all exit 0. Wire Playwright into CI only if Compose `--wait` is reliable, otherwise run it locally and say so

## Workflow follow-up

- Open a ready PR, wait for CI green on the PR head, merge locally with `--no-ff` as Christian Agila, then `openspec archive add-ui-status-dashboard --yes` as a direct commit on main.
