# auth Specification

## Purpose
Lets a person create an account with email and password, keep a server-side session, and sign out so that session can no longer be used.

## Requirements

### Requirement: FR-AUTH-001 Register with email and password
The system SHALL create a user when given a unique email and a password of at least 8 characters, store only a password hash, and start an authenticated session.

#### Scenario: Successful registration
- **WHEN** a client submits a new email and a password of at least 8 characters
- **THEN** the system persists the user, returns 201, and sets a session cookie

#### Scenario: Duplicate email
- **WHEN** a client registers with an email that already exists, compared case-insensitively
- **THEN** the system returns 409 CONFLICT and does not create a second user

#### Scenario: Invalid registration input
- **WHEN** the email is malformed or the password is shorter than 8 characters
- **THEN** the system returns 400 VALIDATION_FAILED with field-level details

### Requirement: FR-AUTH-001 Login creates a session
The system SHALL authenticate a stored email and password and issue a new server-side session on success.

#### Scenario: Successful login
- **WHEN** a client submits the correct email and password
- **THEN** the system returns 200, creates a session row, and sets the session cookie

#### Scenario: Unknown email or wrong password
- **WHEN** the email is unknown or the password does not match
- **THEN** the system returns 401 UNAUTHENTICATED with the same message in both cases

### Requirement: FR-AUTH-001 Logout revokes the session
The system SHALL delete or otherwise invalidate the current session so the cookie can no longer authenticate.

#### Scenario: Logout revokes server-side
- **WHEN** an authenticated client posts logout with a valid CSRF token
- **THEN** the session row is gone or marked revoked and a later authenticated request with that cookie returns 401

### Requirement: NFR-SEC-001 Password hashing
The system SHALL hash passwords with Argon2id (or bcrypt cost at least 12) and MUST never persist or log the plaintext password.

#### Scenario: Stored credential is a hash
- **WHEN** a user is created
- **THEN** `password_hash` is not equal to the submitted password and is an Argon2id hash

### Requirement: NFR-SEC-001 Session cookie flags
The system SHALL set the session cookie HttpOnly, SameSite=Lax, Path=/, and Secure when NODE_ENV is production. Sessions live in Postgres and expire after 7 days of inactivity.

#### Scenario: Cookie flags in development
- **WHEN** a session is issued with NODE_ENV other than production
- **THEN** the Set-Cookie value includes HttpOnly and SameSite=Lax and does not include Secure

#### Scenario: Cookie flags in production
- **WHEN** a session is issued with NODE_ENV=production
- **THEN** the Set-Cookie value includes HttpOnly, SameSite=Lax, and Secure

#### Scenario: Expired session
- **WHEN** a request presents a session whose expires_at is in the past
- **THEN** the system returns 401 UNAUTHENTICATED

### Requirement: NFR-SEC-001 CSRF on mutating cookie-auth routes
The system SHALL reject cookie-authenticated POST, PATCH, PUT, and DELETE requests unless they carry a CSRF token that matches the CSRF cookie (double-submit). Bearer-authenticated mutations MUST NOT be rejected for missing CSRF.

#### Scenario: Mutating request without CSRF token
- **WHEN** an authenticated client sends POST, PATCH, PUT, or DELETE without a matching CSRF header or cookie pair
- **THEN** the system returns 403 FORBIDDEN with code indicating CSRF failure and does not perform the mutation

#### Scenario: Mutating request with matching token
- **WHEN** an authenticated client sends a mutation with X-CSRF-Token equal to the csrf cookie
- **THEN** CSRF validation passes and the request is authorized as the session user

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
