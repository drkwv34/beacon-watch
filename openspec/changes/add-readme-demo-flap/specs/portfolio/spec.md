# Spec Delta

## Purpose

Lets a reviewer run Compose, seed Appendix D data, flap mock-target, and read a README that documents the product, hard edges, and repository metadata (NFR-PORT-001, SRS §9).

## ADDED Requirements

### Requirement: NFR-PORT-001 Appendix D demo seed
`pnpm seed` MUST idempotently create user `demo@beacon.local` with password from `DEMO_PASSWORD`, an enabled public target named `mock-target` at `http://mock-target:8080/health` with slug `demo` and interval 30 seconds, and one paused second target. A second run MUST NOT duplicate those rows.

#### Scenario: First seed creates demo rows
- **WHEN** `pnpm seed` runs against an empty migrated database with `DEMO_PASSWORD` set
- **THEN** the demo user, the public `demo` monitor, and one paused target exist

#### Scenario: Second seed does not duplicate
- **WHEN** `pnpm seed` runs a second time with the same inputs
- **THEN** there is still exactly one demo user, one `demo` public target, and one paused target owned by that user

### Requirement: NFR-PORT-001 Mock-target flap
`scripts/demo-flap.sh` MUST call a mock-target admin endpoint so `/health` returns 500 for N seconds (argument; a documented default) and then restore 200. The admin endpoint MUST NOT be exposed by the api or web services.

#### Scenario: Flap then restore
- **WHEN** Compose is up and a reviewer runs `scripts/demo-flap.sh` with a duration
- **THEN** mock-target `/health` returns 500 for that duration and 200 afterwards

#### Scenario: Admin stays off product ports
- **WHEN** a client calls only the published api or web ports
- **THEN** those services do not provide the mock-target admin toggle

### Requirement: NFR-PORT-001 SRS §9 README
The repository README MUST follow SRS §9 order: problem, why, demo (Compose up → seed → `/s/demo` → `scripts/demo-flap.sh` → red then green), stack, run locally, tests/CI including `pnpm test` / `pnpm test:e2e` and a CI badge, architecture, hard edges, trade-offs, and Repository metadata with the About blurb and topics listed in the Day 8 brief.

#### Scenario: Demo path is documented
- **WHEN** a reviewer reads the README demo section
- **THEN** it names Compose up, seed, `/s/demo`, `scripts/demo-flap.sh`, and watching the public page go red then green

#### Scenario: Hard edges are named
- **WHEN** a reviewer reads the README hard-edges section
- **THEN** it covers SKIP LOCKED plus jitter and no double-check, Redis cache keys/TTL/invalidation and DB degrade, public rate limit 60/min → 429 with headers, and SSRF policy per Appendix C

### Requirement: NFR-PORT-001 Real screenshots
The repository MUST commit Playwright screenshots of the real Compose app (no mocked UI) for `/s/demo` while Up, `/s/demo` while Down during a flap, and the owner dashboard, under `docs/screenshots/`, and embed them in the README.

#### Scenario: Screenshots match the running app
- **WHEN** Playwright captures against Compose after seed
- **THEN** committed images show the public page Up, the public page Down, and the dashboard, and the README references those files

### Requirement: SRS §4.4 env example
`.env.example` MUST document `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `SSRF_PROTECTION`, `PUBLIC_RATE_LIMIT_PER_MIN`, `APP_BASE_URL`, `DEMO_PASSWORD`, and every other variable the apps already read, using non-secret placeholders. The `SSRF_PROTECTION` comment MUST state that false is only for the Compose worker demo.

#### Scenario: Required keys are present
- **WHEN** a reviewer opens `.env.example`
- **THEN** those named keys exist with placeholders and a comment that worker SSRF protection is off only so probes can reach `mock-target` on the Docker network
