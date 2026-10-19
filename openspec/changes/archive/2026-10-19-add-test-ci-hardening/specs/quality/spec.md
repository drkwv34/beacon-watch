# Spec Delta

## Purpose

Defines the committed test pyramid and CI full gate that verify already-shipped monitoring, incident, public API, and dashboard behavior without changing those product contracts.

## ADDED Requirements

### Requirement: NFR-MAINT-001 CI full gate
The repository MUST run a GitHub Actions workflow on every pull request and on `main` that executes format check, lint, typecheck, unit and integration tests, production build, Compose file validation with image build, and Playwright e2e against Compose `--wait`. No job in that gate MAY be deleted, skipped, or loosened to obtain a green run.

#### Scenario: Quality job order
- **WHEN** a pull request is opened
- **THEN** the quality job runs frozen-lockfile install, format check, lint, typecheck, Vitest, and build in that order against Postgres 16 and Redis 7 services

#### Scenario: Playwright stays on Compose --wait
- **WHEN** the e2e job runs
- **THEN** it starts the Compose stack with `--wait`, runs `pnpm test:e2e` against the published web port, and dumps Compose process list and logs on failure

#### Scenario: Failure is not skipped
- **WHEN** any gate job fails
- **THEN** the workflow MUST remain failed; adding `continue-on-error` or dropping the job is forbidden

### Requirement: FR-INC-001..004 NFR-REL-002 Incident machine unit tests
`pnpm test` MUST include pure unit tests of the incident counter machine that open on consecutive failures reaching grace, resolve on consecutive successes reaching recovery, and stay quiet on a single isolated failure.

#### Scenario: Fail then success is no-noise
- **WHEN** grace is 2 and checks arrive as fail then success with no open incident
- **THEN** the action is none for both checks and no incident is considered open

#### Scenario: Fail fail opens
- **WHEN** grace is 2 and checks arrive as fail then fail with no open incident
- **THEN** the second check's action is open

#### Scenario: Consecutive successes resolve
- **WHEN** an incident is open, recovery is 2, and two consecutive successes arrive
- **THEN** the second success's action is resolve

### Requirement: FR-SCH-001 Scheduler lease integration
Integration tests MUST prove two concurrent claimers never double-check the same due target and that a claimed row is leased out of the due set before the probe.

#### Scenario: Two workers one check
- **WHEN** two scheduler ticks claim the same due target at the same time
- **THEN** exactly one check row is written for that claim cycle

#### Scenario: Lease excludes the row
- **WHEN** a worker has claimed a due target
- **THEN** a second claim immediately after MUST NOT return that same row

### Requirement: FR-SCH-005 Concurrency semaphore under tick
Integration tests MUST prove the scheduler claim batch and in-flight probes respect the global and per-host semaphores.

#### Scenario: Global cap
- **WHEN** more targets are due than the global max and `tick` runs
- **THEN** at most that many probes run at once

#### Scenario: Per-host cap
- **WHEN** more due targets share a hostname than the per-host max and `tick` runs
- **THEN** at most that many probes to that host run at once

### Requirement: FR-INC-* Incident persist sequences
Integration tests against Postgres MUST persist fail/success sequences through the same check-insert path the worker uses and assert incident rows.

#### Scenario: Isolated failure does not persist an incident
- **WHEN** a target with grace 2 records fail then success
- **THEN** no incident row exists

#### Scenario: Open then resolve
- **WHEN** a target with grace 2 and recovery 2 records fail, fail, success, success
- **THEN** exactly one incident exists and it is resolved

### Requirement: FR-PUB-004 NFR-SEC-002 Public 429 bursts
Integration tests MUST burst the public status API past `PUBLIC_RATE_LIMIT_PER_MIN` using distinct client IPs (or a flushed limiter key per case) so tests do not share Redis counter state.

#### Scenario: Over-quota is 429
- **WHEN** one IP sends one more public status request than the configured per-minute limit
- **THEN** that response is 429 RATE_LIMITED with Retry-After and X-RateLimit-Remaining 0

#### Scenario: Other IP unaffected
- **WHEN** a second IP sends a public status request in the same window after the first IP is over quota
- **THEN** the second IP is not 429

### Requirement: FR-SCH-002 NFR-SEC-001 SSRF rejection tests
Tests MUST cover create-time URL rejection and probe-time `SSRF_BLOCKED` for loopback, RFC1918, and DNS-to-private destinations. Tests MUST NOT contact real third-party hosts.

#### Scenario: Create rejects private literals
- **WHEN** an authenticated owner POSTs a target whose URL is loopback or RFC1918
- **THEN** the API returns 400 VALIDATION_FAILED on url

#### Scenario: Probe blocks private destinations
- **WHEN** SSRF protection is on and the probe URL is a loopback or RFC1918 literal, or DNS returns a private address
- **THEN** the probe result is failure with error_code SSRF_BLOCKED

### Requirement: Playwright login smoke
`pnpm test:e2e` MUST include a Playwright smoke against the real Compose stack: sign in, add a mock-target monitor, and see labelled status on the dashboard and the public page. Selectors MUST be role or label based. The e2e environment MUST raise the public rate limit or use distinct IPs so the smoke does not 429 itself.

#### Scenario: Login then monitor
- **WHEN** a registered owner signs in, creates a monitor pointed at mock-target, and waits for a check
- **THEN** the dashboard list and `/s/{slug}` both show the Up (or Down after flap) text label

#### Scenario: Smoke does not 429
- **WHEN** the Playwright suite runs in CI
- **THEN** public page loads in the smoke are not 429 RATE_LIMITED
