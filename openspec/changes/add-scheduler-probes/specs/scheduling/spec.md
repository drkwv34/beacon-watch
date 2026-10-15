# Spec Delta

## Purpose

Claims due HTTP targets, runs isolated checks, and persists every result so two workers never double-check the same row.

## ADDED Requirements

### Requirement: FR-SCH-001 Due claim with SKIP LOCKED
The system SHALL claim enabled targets where `next_check_at` is less than or equal to now using `FOR UPDATE SKIP LOCKED`, then probe outside that transaction.

#### Scenario: Two workers never double-check
- **WHEN** two worker processes claim the same due target at the same time
- **THEN** exactly one worker probes it and exactly one check row is written for that claim cycle

#### Scenario: Disabled targets are skipped
- **WHEN** a target is due but `enabled` is false
- **THEN** the worker MUST NOT claim or probe it

#### Scenario: Probe is outside the claim transaction
- **WHEN** a claimed target is probed
- **THEN** the claim transaction is already committed so the probe holds no row lock

### Requirement: FR-SCH-001 Lease and jitter
After claiming a target the system SHALL set `next_check_at` to now plus `interval_seconds` plus jitter in `[0, 10%]` of the interval before probing.

#### Scenario: Lease pushes the row out of the due set
- **WHEN** a worker claims a due target
- **THEN** a second claim immediately after MUST NOT return that same row

#### Scenario: Jitter is bounded
- **WHEN** the interval is 60 seconds and a claim completes
- **THEN** `next_check_at` is between 60 and 66 seconds after the claim clock

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
