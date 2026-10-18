# Spec Delta

## Purpose

Owner dashboard and public HTML status pages that consume the existing API, with labelled status, empty states, and keyboard-usable forms.

## ADDED Requirements

### Requirement: FR-UI-001 Target list with labelled badges
The dashboard list SHALL show each owned target with a status badge that includes a text label (`Up`, `Down`, `Paused`, `Unknown`), the latest latency, and last-checked time. Color MUST NOT be the only status indicator.

#### Scenario: List shows badge text and freshness
- **WHEN** an owner with at least one target opens `/dashboard`
- **THEN** each row shows the target name, a badge whose text matches the display status, latency when a check exists, and last-checked time

#### Scenario: Paused uses the paused label
- **WHEN** a listed target has enabled false
- **THEN** the badge text is `Paused` even if last_status was up

### Requirement: FR-TGT-003 Empty dashboard copy
When the owner has zero targets the dashboard MUST render the empty-state copy and primary CTA **"Add your first monitor."** linking to create.

#### Scenario: Zero targets
- **WHEN** an authenticated user with an empty list opens `/dashboard`
- **THEN** the page shows "Add your first monitor." and a control with that same label that goes to `/dashboard/targets/new`

### Requirement: FR-UI-002 Target detail
Target detail SHALL show a status header, a recent checks table (time, status code, latency, success/error), an incident timeline (opened/resolved, duration, open incident highlighted), and an edit form that can pause, resume, and delete with confirmation.

#### Scenario: Checks and incidents render
- **WHEN** the owner opens `/dashboard/targets/:id` for a target that has checks and incidents
- **THEN** the checks table lists newest first and the timeline shows duration with the open incident distinguished from resolved ones

#### Scenario: Delete requires confirmation
- **WHEN** the owner chooses delete
- **THEN** the target is not removed until they confirm, after which they return to the empty or remaining list

### Requirement: FR-UI-003 Create form inline validation
The create form SHALL expose SRS §3.2 fields. Inline errors MUST map from `VALIDATION_FAILED.details.fields`. HTTP 409 CONFLICT for a taken slug MUST appear on the slug field. Submit is disabled while pending.

#### Scenario: Field errors from 400
- **WHEN** create returns 400 VALIDATION_FAILED with details.fields.url set
- **THEN** the URL input shows that message via aria-describedby and focus moves to the first invalid field

#### Scenario: Slug taken
- **WHEN** create returns 409 with details.field public_slug
- **THEN** the slug field shows that the slug is taken

### Requirement: FR-UI-004 Check now
Target detail SHALL offer a Check now control that POSTs to the owner-only check-now endpoint. The control MUST be disabled while the request is in flight and when the target is paused.

#### Scenario: Owner queues an immediate check
- **WHEN** the owner clicks Check now on an enabled target
- **THEN** the UI calls the check-now API and the target becomes due for the worker

### Requirement: FR-PUB-001 Public status HTML
Unauthenticated `GET /s/[slug]` SHALL be server-rendered from the public JSON API and show target name, current state with text, last-24h uptime, recent incidents, and last checked time. Private, slugless, or unknown slugs MUST produce the same Next.js 404 without leaking ids, URLs, or owner identity.

#### Scenario: Public slug renders
- **WHEN** a public target with checks is requested at `/s/{slug}`
- **THEN** the page shows the name, a labelled status, uptime_24h as a percentage when not null, last checked time, and recent incidents

#### Scenario: Private and unknown are identical 404
- **WHEN** the slug is private, unused, or the target has no public_slug
- **THEN** Next.js renders the same 404 page with no target ids, URLs, or owner data

#### Scenario: Rate limited or Redis-down public API
- **WHEN** the public JSON API returns 429 or 503
- **THEN** the page shows "Status temporarily unavailable" and does not crash

### Requirement: FR-PUB-002 Status empty states
The public page MUST select copy from the public JSON: no checks → "Monitoring starting…"; paused → "Monitoring is paused"; checks exist but none succeeded → "No successful checks yet."

#### Scenario: No checks
- **WHEN** check_count is 0 and status is not paused
- **THEN** the page shows "Monitoring starting…"

#### Scenario: Paused
- **WHEN** status is paused
- **THEN** the page shows "Monitoring is paused"

#### Scenario: Never succeeded
- **WHEN** check_count is greater than 0 and ever_succeeded is false and status is not paused
- **THEN** the page shows "No successful checks yet."

### Requirement: NFR-A11Y-001 Keyboard and labels
Status page and forms MUST be keyboard-usable, every input MUST have a visible label, and heading order MUST be h1 then h2 without skipping levels. Status badges MUST include text, never color alone.

#### Scenario: Form labels and focus
- **WHEN** a user tabs through the create or edit form
- **THEN** every control is reachable, labelled, and shows a visible focus outline
