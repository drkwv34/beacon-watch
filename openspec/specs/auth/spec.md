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
The system SHALL reject cookie-authenticated POST, PATCH, PUT, and DELETE requests unless they carry a CSRF token that matches the CSRF cookie (double-submit).

#### Scenario: Mutating request without CSRF token
- **WHEN** an authenticated client sends POST, PATCH, PUT, or DELETE without a matching CSRF header or cookie pair
- **THEN** the system returns 403 FORBIDDEN with code indicating CSRF failure and does not perform the mutation

#### Scenario: Mutating request with matching token
- **WHEN** an authenticated client sends a mutation with X-CSRF-Token equal to the csrf cookie
- **THEN** CSRF validation passes and the request is authorized as the session user

### Requirement: FR-AUTH-002 Authenticated API requires a session
The system SHALL require a valid session for every `/api/v1` route except register and login. Unauthenticated callers receive 401, including on paths that do not exist, so tests can probe `/api/v1/__probe`.

#### Scenario: Missing session on a protected path
- **WHEN** a client calls GET `/api/v1/__probe` with no session cookie
- **THEN** the system returns 401 UNAUTHENTICATED

#### Scenario: Valid session on me
- **WHEN** a client with a valid session cookie calls GET `/api/v1/auth/me`
- **THEN** the system returns 200 and the user's public profile (id, email) without the password hash
