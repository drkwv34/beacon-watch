# Spec Delta

## MODIFIED Requirements

### Requirement: NFR-SEC-001 Probe-time SSRF
When `SSRF_PROTECTION` is true the probe MUST accept only http(s) URLs without userinfo, resolve DNS once, reject private, loopback, link-local, CGNAT, unspecified, IPv4-mapped, unique-local, and metadata addresses, pin the validated IP, and repeat the check on every redirect hop. Blocked destinations MUST fail with `SSRF_BLOCKED` before any socket is opened. An exact hostname exception MUST NOT be a subnet allowlist and MUST NOT apply to a later hop.

#### Scenario: Private address blocked at probe
- **WHEN** SSRF protection is on and the URL resolves to 10.0.0.1
- **THEN** the check fails with `SSRF_BLOCKED` and no request is sent to that address

#### Scenario: Redirect to private blocked
- **WHEN** SSRF protection is on and a redirect Location resolves to a loopback or RFC1918 address
- **THEN** the check fails with `SSRF_BLOCKED`

#### Scenario: Compose demo with protection off
- **WHEN** the worker runs with `SSRF_PROTECTION=false` as an explicit insecure override
- **THEN** probes to `http://mock-target:8080` are allowed and the worker warns that this is not the Compose demo path

#### Scenario: Compose demo with host exception
- **WHEN** SSRF protection is on and the exact hostname exception includes `mock-target`
- **THEN** probes to `http://mock-target:8080` are allowed even if Docker DNS returns a private address

#### Scenario: Exception is not inherited by the next hop
- **WHEN** the first hop hostname is `mock-target` and the redirect Location is `http://169.254.169.254/`, `http://127.0.0.1/`, or an RFC1918 literal
- **THEN** the check fails with `SSRF_BLOCKED` and no socket is opened to that Location

#### Scenario: Mixed DNS and rebinding are pinned
- **WHEN** SSRF protection is on and DNS for a hop returns any blocked address, or later answers would differ
- **THEN** the hop is `SSRF_BLOCKED` if any answer is blocked, and an allowed hop dials only the address validated for that hop

#### Scenario: Explicit insecure mode is warned
- **WHEN** the worker starts with `SSRF_PROTECTION=false`
- **THEN** it logs a warning that probe hops are not checked against private, loopback, or metadata addresses and that this is not the Compose demo path
