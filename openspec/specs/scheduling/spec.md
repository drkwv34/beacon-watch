# scheduling Specification

## Purpose
Claims due HTTP targets, runs isolated checks, and persists every result so two workers never double-check the same row.

## Requirements

### Requirement: FR-SCH-001 Due claim with SKIP LOCKED
The system SHALL claim enabled targets that are due (`next_check_at` less than or equal to now, or `manual_check_requested`) and whose probe lease is absent or expired, using `FOR UPDATE SKIP LOCKED`, then probe outside that transaction.

#### Scenario: Two workers never double-check
- **WHEN** two worker processes claim the same due target at the same time
- **THEN** exactly one worker probes it and exactly one check row is written for that claim cycle

#### Scenario: Disabled targets are skipped
- **WHEN** a target is due but `enabled` is false
- **THEN** the worker MUST NOT claim or probe it

#### Scenario: Probe is outside the claim transaction
- **WHEN** a claimed target is probed
- **THEN** the claim transaction is already committed so the probe holds no row lock

#### Scenario: Active lease is excluded
- **WHEN** a target has an unexpired probe lease
- **THEN** a second claim MUST NOT return that row even if `next_check_at` is in the past or `manual_check_requested` is set

### Requirement: FR-SCH-001 Lease and jitter
After claiming a target the system SHALL store an owner token and a lease expiry that covers per-host semaphore wait plus `timeout_ms`. The claim MUST NOT use `next_check_at` as the lease. Token-guarded finalization SHALL set `next_check_at` to completion plus `interval_seconds` plus jitter in `[0, 10%]` of the interval and release that lease.

#### Scenario: Lease pushes the row out of the due set
- **WHEN** a worker claims a due target
- **THEN** a second claim immediately after MUST NOT return that same row

#### Scenario: Jitter is bounded
- **WHEN** the interval is 60 seconds and a claimed probe completes
- **THEN** `next_check_at` is between 60 and 66 seconds after the completion clock

#### Scenario: Stale owner cannot finalize a newer lease
- **WHEN** a lease expires, another worker claims the row, and the previous owner finalizes
- **THEN** the newer lease and its `next_check_at` MUST remain unchanged and no extra check row is written for the stale persist

### Requirement: FR-SCH-003 Check success definition
A check SHALL be successful only when the TCP/TLS handshake succeeds and the HTTP status equals the target's `expected_status`. Latency MUST be recorded. DNS failure, timeout, TLS failure, connect failure, unexpected status, SSRF block, and redirect-limit MUST be failures.

#### Scenario: Matching status is success
- **WHEN** the probe completes with TCP/TLS ok and status equal to `expected_status`
- **THEN** the stored check has `success` true and a `latency_ms` value

#### Scenario: Unexpected status is failure
- **WHEN** the probe receives a status other than `expected_status`
- **THEN** the stored check has `success` false and error_code `UNEXPECTED_STATUS`

#### Scenario: Timeout is failure
- **WHEN** the probe exceeds `timeout_ms`
- **THEN** the stored check has `success` false and error_code `TIMEOUT` and the worker pool is not hung

### Requirement: FR-SCH-004 Persist checks
The system SHALL append a check row with `target_id`, `checked_at`, `success`, `status_code`, `latency_ms`, `error_code`, and `error_message` truncated to 500 characters. Checks are append-only.

#### Scenario: Fields are stored
- **WHEN** a probe finishes
- **THEN** a `checks` row exists with those fields and `error_message` at most 500 characters

#### Scenario: Target delete cascades
- **WHEN** the owner deletes a target
- **THEN** that target's check rows are deleted

### Requirement: FR-SCH-005 NFR-PERF-002 Probe concurrency
The system SHALL cap in-flight probes at `PROBE_MAX_CONCURRENCY` (default 20) globally and `PROBE_MAX_PER_HOST` (default 2) per hostname. Excess due targets wait. Claim batch size MUST NOT exceed available global permits.

#### Scenario: Global semaphore
- **WHEN** more targets are due than the global max
- **THEN** at most that many probes run at once and the rest wait

#### Scenario: Per-host semaphore
- **WHEN** more than two due targets share a hostname
- **THEN** at most two probes to that host run at once

### Requirement: FR-SCH-001 Crash recovery of expired leases
The system SHALL treat a probe lease as free when `probe_lease_expires_at` is null or less than or equal to now so a later worker can claim the row after a crash.

#### Scenario: Expired lease is reclaimable
- **WHEN** a claimed worker never finalizes and the lease expiry is in the past
- **THEN** the next claim MAY return that target with a new owner token

### Requirement: FR-SCH-001 Check-now coalesces with an in-flight probe
A manual check request that arrives while a probe lease is held SHALL be satisfied by that in-flight check. The system MUST NOT start a second probe for that request.

#### Scenario: Check-now during claim, queue, or probe
- **WHEN** two workers run against six slow targets on one host with per-host max 2, and check-now is posted while those rows are claimed, queued, or probing
- **THEN** exactly one probe runs per target for that request and every target still completes
