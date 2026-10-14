# targets Specification

## Purpose
Lets an authenticated owner create, list, update, pause, and hard-delete HTTP monitor targets with SRS field limits, SSRF checks, and an empty dashboard state.

## Requirements

### Requirement: FR-TGT-001 Create target
The system SHALL create a target owned by the current user and return 201 with the persisted record. Defaults: method GET, interval_seconds 60, timeout_ms 5000, expected_status 200, grace_threshold 2, recovery_threshold 2, enabled true, is_public false.

#### Scenario: Successful create
- **WHEN** an authenticated owner posts a valid name and http(s) URL
- **THEN** the system returns 201 and the target includes owner-scoped id, defaults above, and last_status unknown

#### Scenario: Per-user cap
- **WHEN** the owner already has 50 targets and posts another
- **THEN** the system returns 400 VALIDATION_FAILED and does not insert a 51st row

### Requirement: FR-TGT-001 Validation bounds
The system SHALL accept only SRS §3.2 inputs: name 1–100 chars; url http or https without userinfo; method GET, HEAD, or POST; interval_seconds in [30, 3600]; timeout_ms in [500, 10000]; expected_status 100–599; optional headers totaling at most 8 KiB; POST body at most 8 KiB and only when method is POST; thresholds 1–10; optional public_slug matching `[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?`.

#### Scenario: Each bound rejects
- **WHEN** a create or update sets interval_seconds 29, 3601, timeout_ms 499, 10001, method PUT, a ftp URL, a body on GET, a body over 8 KiB, or an oversized headers object
- **THEN** the system returns 400 VALIDATION_FAILED naming the offending field

#### Scenario: POST body allowed
- **WHEN** method is POST and body is at most 8192 bytes
- **THEN** the target is accepted and the body is stored

### Requirement: FR-TGT-002 Update pause and delete
The system SHALL let the owner patch any mutable fields, pause by setting enabled false, and hard-delete the target row. Delete of the target is permanent in this change (checks and incidents do not exist yet).

#### Scenario: Pause
- **WHEN** the owner PATCHes `{ "enabled": false }`
- **THEN** the target remains listed with enabled false and display status paused

#### Scenario: Hard delete
- **WHEN** the owner DELETEs the target
- **THEN** the system returns 204 and a later GET of that id returns 404

#### Scenario: Slug taken
- **WHEN** the owner sets public_slug to a value already used by any target
- **THEN** the system returns 409 CONFLICT with details.field public_slug

### Requirement: NFR-SEC-001 SSRF at target validation
When SSRF_PROTECTION is true, create and update SHALL resolve the URL hostname, reject userinfo, non-http(s) schemes, and any resolved address that is loopback, RFC1918, link-local, CGNAT, unspecified, IPv4-mapped equivalents, unique-local IPv6, or metadata hostnames. Hostnames on SSRF_ALLOWLIST skip the address check so Compose can target mock-target.

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

### Requirement: FR-AUTH-002 FR-ERR-003 Ownership
Every target read and mutation SHALL be scoped to the session user. A target that exists but belongs to someone else returns 403 FORBIDDEN. An unknown id returns 404 NOT_FOUND.

#### Scenario: Non-owner mutation
- **WHEN** user B GET, PATCH, or DELETE a target owned by user A
- **THEN** the system returns 403 FORBIDDEN and does not change the row

#### Scenario: Unknown id
- **WHEN** the owner GET, PATCH, or DELETE a well-formed id that does not exist
- **THEN** the system returns 404 NOT_FOUND

#### Scenario: List is owner-scoped
- **WHEN** user A lists targets
- **THEN** the response contains only A's targets

### Requirement: FR-TGT-003 Empty dashboard
The system SHALL expose GET `/api/v1/targets` returning the owner's targets (possibly empty). The dashboard MUST render StatePanel copy "Add your first monitor." with a CTA to create a target when the list is empty.

#### Scenario: Empty list API
- **WHEN** an authenticated user with zero targets calls GET `/api/v1/targets`
- **THEN** the system returns 200 and an empty items array

#### Scenario: Empty dashboard UI
- **WHEN** that user opens `/dashboard`
- **THEN** the page shows "Add your first monitor." and a link to add a monitor
