# Spec Delta

## MODIFIED Requirements

### Requirement: NFR-SEC-001 SSRF at target validation
When SSRF_PROTECTION is true, create and update SHALL resolve the URL hostname, reject userinfo, non-http(s) schemes, and any resolved address that is loopback, RFC1918, link-local, CGNAT, unspecified, IPv4-mapped equivalents, unique-local IPv6, or metadata hostnames. Hostnames on SSRF_ALLOWLIST skip the address check so Compose can target mock-target. Create and update MUST NOT follow redirects or send outbound HTTP to the target.

#### Scenario: Loopback rejected
- **WHEN** the URL host is 127.0.0.1 or localhost and SSRF_PROTECTION is true without an allowlist match
- **THEN** the system returns 400 VALIDATION_FAILED for field url

#### Scenario: RFC1918 rejected
- **WHEN** the URL host is 10.0.0.1, 172.16.0.1, or 192.168.1.1 and SSRF_PROTECTION is true
- **THEN** the system returns 400 VALIDATION_FAILED for field url

#### Scenario: Link-local and metadata rejected
- **WHEN** the URL host is 169.254.169.254 or metadata.google.internal and SSRF_PROTECTION is true
- **THEN** the system returns 400 VALIDATION_FAILED for field url

#### Scenario: DNS to private rejected
- **WHEN** DNS for the hostname returns any private or loopback address
- **THEN** the system returns 400 VALIDATION_FAILED for field url

#### Scenario: Allowlist for demo
- **WHEN** SSRF_ALLOWLIST includes mock-target and the URL host is mock-target
- **THEN** create succeeds even if the name would resolve to a private Docker address

#### Scenario: Create does not follow redirects
- **WHEN** the submitted URL host is public or allowlisted and that URL would redirect to a private or metadata address
- **THEN** create and update still accept the target if the initial URL passes the synchronous check, and no outbound fetch is performed
