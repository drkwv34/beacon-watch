# Spec Delta

## MODIFIED Requirements

### Requirement: NFR-PORT-001 Appendix D demo seed
`pnpm seed` MUST idempotently create user `demo@beacon.local` with password from `DEMO_PASSWORD`, an enabled public target named `mock-target` at `http://mock-target:8080/health` with slug `demo` and interval 30 seconds, and one paused second target. A second run MUST NOT duplicate those rows. The CLI MUST load an optional root `.env` with exported variables winning, MUST NOT hardcode credentials, and MUST fail with a key-only error when neither file nor exports supply required values.

#### Scenario: First seed creates demo rows
- **WHEN** `pnpm seed` runs against an empty migrated database with `DEMO_PASSWORD` set
- **THEN** the demo user, the public `demo` monitor, and one paused target exist

#### Scenario: Second seed does not duplicate
- **WHEN** `pnpm seed` runs a second time with the same inputs
- **THEN** there is still exactly one demo user, one `demo` public target, and one paused target owned by that user

#### Scenario: Root env file is loaded without exports
- **WHEN** `DATABASE_URL` and `DEMO_PASSWORD` are unset in the process environment and a root `.env` contains them
- **THEN** `pnpm seed` creates the demo rows using those file values

#### Scenario: Exported env wins over the file
- **WHEN** the process already has `DEMO_PASSWORD` and a root `.env` has a different `DEMO_PASSWORD`
- **THEN** seed uses the exported value and error messages MUST NOT include either password

#### Scenario: Missing file and exports fail safely
- **WHEN** there is no root `.env` and required seed variables are unset
- **THEN** the CLI exits non-zero naming the missing keys and MUST NOT print secret values

#### Scenario: Compose db hostname is rewritten on the host
- **WHEN** `DATABASE_URL` uses hostname `db` and `db` does not resolve
- **THEN** seed connects via `127.0.0.1` and still stores the mock-target Docker URL

### Requirement: NFR-PORT-001 SRS §9 README
The repository README MUST follow SRS §9 order: problem, why, demo (Compose up → seed → `/s/demo` → `scripts/demo-flap.sh` → red then green), stack, run locally, tests/CI including `pnpm test` / `pnpm test:e2e` and a CI badge, architecture, hard edges, trade-offs, and Repository metadata with the About blurb and topics listed in the Day 8 brief. The Demo section MUST require copying `.env.example` to `.env` before `pnpm seed` and MUST NOT describe that copy as optional.

#### Scenario: Demo path is documented
- **WHEN** a reviewer reads the README demo section
- **THEN** it names Compose up, seed, `/s/demo`, `scripts/demo-flap.sh`, and watching the public page go red then green

#### Scenario: Hard edges are named
- **WHEN** a reviewer reads the README hard-edges section
- **THEN** it covers SKIP LOCKED plus jitter and no double-check, Redis cache keys/TTL/invalidation and DB degrade, public rate limit 60/min → 429 with headers, and SSRF policy per Appendix C

#### Scenario: Env copy is required for seed
- **WHEN** a reviewer reads the README demo section
- **THEN** it tells them to copy `.env.example` to `.env` before `pnpm seed` and does not call that copy optional
