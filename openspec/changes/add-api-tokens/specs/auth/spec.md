# Spec Delta

## ADDED Requirements

### Requirement: FR-AUTH-003 Opaque management tokens
The system SHALL let a session user create, list, and revoke opaque API tokens. Tokens MUST be random (not JWT). Only a domain-separated hash of the secret is stored. Create returns the full secret once with id, label, and prefix. List and later responses MUST omit the secret. Revoke immediately prevents further Bearer use.

#### Scenario: Create returns the secret once
- **WHEN** an authenticated session posts a label to `/api/v1/tokens` with a valid CSRF token
- **THEN** the system returns 201 with `token`, `id`, `label`, and `prefix`, and a later list of tokens does not include that `token` value

#### Scenario: List omits the secret
- **WHEN** the owner GETs `/api/v1/tokens` with a session
- **THEN** each item includes id, label, prefix, created_at, and optional expires_at and does not include the raw secret or hash

#### Scenario: Revoke stops Bearer access
- **WHEN** the owner DELETEs a token id with CSRF and then calls a protected target route with that Bearer token
- **THEN** the delete is 204 and the Bearer request returns 401 UNAUTHENTICATED

#### Scenario: Invalid or expired token is 401
- **WHEN** a client sends Authorization Bearer with an unknown, expired, or revoked token
- **THEN** the system returns 401 UNAUTHENTICATED

#### Scenario: Hash only in the database
- **WHEN** a token is created
- **THEN** the stored row's hash is not equal to the secret and no column contains the raw token

### Requirement: FR-AUTH-003 Bearer owner access
A valid Bearer token SHALL authenticate as the owning user for target CRUD, check-now, checks list, and incident timeline, with the same 403/404 ownership mapping as a session. Bearer MUST NOT login, logout, or create, list, or revoke tokens.

#### Scenario: Bearer can manage owned targets
- **WHEN** the owner sends Authorization Bearer with a live token to create, get, patch, list, delete a target, POST check-now, and GET checks and incidents for that target
- **THEN** those requests succeed with the same status codes as a session (201/200/202/204/200) and check-now is 202

#### Scenario: Bearer cannot access another user's target
- **WHEN** user B's token is used on user A's target
- **THEN** the system returns 403 FORBIDDEN and does not change the row

#### Scenario: Bearer cannot administer tokens
- **WHEN** a valid Bearer token is used to POST, GET, or DELETE `/api/v1/tokens`
- **THEN** the system returns 403 FORBIDDEN and does not create or revoke a token

### Requirement: NFR-SEC-001 CSRF skipped only for real Bearer
Cookie-authenticated mutations MUST still require a matching CSRF token even if an Authorization header is present. CSRF MUST be skipped only when the request authenticated as Bearer with a valid token.

#### Scenario: Session mutation without CSRF is 403 despite fake Authorization
- **WHEN** a session user POSTs a mutation without a matching CSRF token and with an Authorization header that is not a valid token
- **THEN** the system returns 403 FORBIDDEN and does not perform the mutation

#### Scenario: Bearer mutation does not need CSRF
- **WHEN** a valid Bearer token is used on POST `/api/v1/targets/:id/check-now` without CSRF cookies
- **THEN** the system returns 202 when the target is owned

## MODIFIED Requirements

### Requirement: FR-AUTH-002 Authenticated API requires a session
The system SHALL require a valid session or a valid API Bearer token for every `/api/v1` route except register and login. Callers with neither receive 401, including on paths that do not exist, so tests can probe `/api/v1/__probe`.

#### Scenario: Missing session on a protected path
- **WHEN** a client calls GET `/api/v1/__probe` with no session cookie
- **THEN** the system returns 401 UNAUTHENTICATED

#### Scenario: Valid session on me
- **WHEN** a client with a valid session cookie calls GET `/api/v1/auth/me`
- **THEN** the system returns 200 and the user's public profile (id, email) without the password hash

#### Scenario: Valid Bearer on me
- **WHEN** a client with a valid Bearer token and no session cookie calls GET `/api/v1/auth/me`
- **THEN** the system returns 200 and the token owner's public profile

### Requirement: NFR-SEC-001 CSRF on mutating cookie-auth routes
The system SHALL reject cookie-authenticated POST, PATCH, PUT, and DELETE requests unless they carry a CSRF token that matches the CSRF cookie (double-submit). Bearer-authenticated mutations MUST NOT be rejected for missing CSRF.

#### Scenario: Mutating request without CSRF token
- **WHEN** an authenticated client sends POST, PATCH, PUT, or DELETE without a matching CSRF header or cookie pair
- **THEN** the system returns 403 FORBIDDEN with code indicating CSRF failure and does not perform the mutation

#### Scenario: Mutating request with matching token
- **WHEN** an authenticated client sends a mutation with X-CSRF-Token equal to the csrf cookie
- **THEN** CSRF validation passes and the request is authorized as the session user
