# Spec Delta

## Purpose

Defines the only outbound HTTP client that may contact monitored URLs, with Appendix C limits and probe-time SSRF.

## ADDED Requirements

### Requirement: FR-SCH-002 Isolated probe client
Outbound HTTP to monitored targets MUST exist only in the worker probe module. The client MUST use a dedicated connection pool, set `User-Agent` to `beacon-watch/1.0`, use no cookie jar, and verify TLS by default.

#### Scenario: User-Agent is fixed
- **WHEN** any probe request is sent
- **THEN** the request includes `User-Agent: beacon-watch/1.0` and the target cannot override it

#### Scenario: No cookies
- **WHEN** a target responds with `Set-Cookie`
- **THEN** a later probe to the same host MUST NOT send a Cookie header

### Requirement: FR-SCH-002 Appendix C timeouts and body cap
The probe MUST cancel after `target.timeout_ms` covering connect, headers, and body. Connect timeout MUST be `min(2000, timeout_ms)`. The client MUST read at most 4096 body bytes then abort and discard the rest. An oversized body is not a failure by itself.

#### Scenario: Slow endpoint times out
- **WHEN** mock-target delays longer than `timeout_ms`
- **THEN** the check fails with `TIMEOUT` and other in-flight probes continue

#### Scenario: Body cap
- **WHEN** the response body is larger than 4096 bytes and the status matches `expected_status`
- **THEN** the check is classified by status (success) and the extra body is not retained

### Requirement: FR-SCH-002 Redirect limit
The probe MUST follow at most three redirects and MUST re-validate the next hop before following it. A fourth redirect MUST fail the check with `REDIRECT_LIMIT`.

#### Scenario: Three hops allowed
- **WHEN** the target redirects three times to a permitted URL that returns `expected_status`
- **THEN** the check succeeds

#### Scenario: Fourth redirect fails
- **WHEN** the target would require a fourth redirect
- **THEN** the check fails with `REDIRECT_LIMIT` and is not followed further

### Requirement: NFR-SEC-001 Probe-time SSRF
When `SSRF_PROTECTION` is true the probe MUST accept only http(s) URLs without userinfo, resolve DNS once, reject private, loopback, link-local, CGNAT, unspecified, IPv4-mapped, unique-local, and metadata addresses, pin the validated IP, and repeat the check on every redirect hop. Blocked destinations MUST fail with `SSRF_BLOCKED`.

#### Scenario: Private address blocked at probe
- **WHEN** SSRF protection is on and the URL resolves to 10.0.0.1
- **THEN** the check fails with `SSRF_BLOCKED` and no request is sent to that address

#### Scenario: Redirect to private blocked
- **WHEN** SSRF protection is on and a redirect Location resolves to a loopback or RFC1918 address
- **THEN** the check fails with `SSRF_BLOCKED`

#### Scenario: Compose demo with protection off
- **WHEN** the worker runs with `SSRF_PROTECTION=false` as Compose does
- **THEN** probes to `http://mock-target:8080` are allowed

### Requirement: FR-ERR-002 Probe failures are data
A probe MUST NOT throw for expected network failures. It MUST return `success` false with a stable `error_code` of `TIMEOUT`, `DNS`, `TLS`, `CONNECT`, `UNEXPECTED_STATUS`, `SSRF_BLOCKED`, `REDIRECT_LIMIT`, or `INTERNAL`. There are no retries inside a single check. An unexpected throw MUST be recorded as `INTERNAL` and MUST NOT crash the worker.

#### Scenario: DNS failure
- **WHEN** the hostname does not resolve
- **THEN** the check is stored as failed with `DNS` and the loop continues

#### Scenario: Isolated unexpected error
- **WHEN** one target's probe throws unexpectedly
- **THEN** that check is stored with `INTERNAL` and other targets keep being checked
