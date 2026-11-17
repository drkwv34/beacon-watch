# Spec Delta

## ADDED Requirements

### Requirement: FR-AUTH-002 Create monitor requires a session
`GET /dashboard/targets/new` SHALL validate the session via `GET /api/v1/auth/me` (cookie forwarded, no local session decode). Unauthenticated or invalid/expired cookies MUST redirect to `/login` without the create form. Dependency outages MUST show an error, not login.

#### Scenario: Anonymous create redirects to login
- **WHEN** a client with no session cookie opens `/dashboard/targets/new`
- **THEN** the response redirects to `/login` and the create form (Name/URL) is not rendered

#### Scenario: Forged or expired cookie redirects to login
- **WHEN** a client sends a `beacon_session` cookie that `/api/v1/auth/me` rejects with 401
- **THEN** the response redirects to `/login` and the create form is not rendered

#### Scenario: Outage is not a login redirect
- **WHEN** `/api/v1/auth/me` returns 503
- **THEN** `/dashboard/targets/new` shows an error panel and does not redirect to `/login` and does not render the create form

### Requirement: FR-AUTH-002 Site nav follows the session
The site header nav SHALL be derived from `GET /api/v1/auth/me` on each request. A validated session MUST NOT show Sign in. After logout the Sign in control MUST return. Nav MUST NOT be reused from another user's response.

#### Scenario: Nav after login
- **WHEN** an owner has a valid session and opens `/dashboard`
- **THEN** the main nav does not contain a Sign in link and does contain Sign out

#### Scenario: Nav after logout
- **WHEN** that owner signs out and then opens a marketing or login page
- **THEN** the main nav contains Sign in and does not contain Sign out

#### Scenario: Nav is not shared across users
- **WHEN** owner A signs out and owner B signs in on the same browser
- **THEN** the nav reflects B (B's email or Sign out for B) and MUST NOT show A's email

## MODIFIED Requirements

### Requirement: FR-UI-003 Create form inline validation
The create form SHALL expose SRS §3.2 fields. Inline errors MUST map from `VALIDATION_FAILED.details.fields`. HTTP 409 CONFLICT for a taken slug MUST appear on the slug field. Submit is disabled while pending. The form MUST remain usable at 375px viewport width.

#### Scenario: Field errors from 400
- **WHEN** create returns 400 VALIDATION_FAILED with details.fields.url set
- **THEN** the URL input shows that message via aria-describedby and focus moves to the first invalid field

#### Scenario: Slug taken
- **WHEN** create returns 409 with details.field public_slug
- **THEN** the slug field shows that the slug is taken

#### Scenario: Owner can open create when signed in
- **WHEN** a session owner opens `/dashboard/targets/new`
- **THEN** the labelled create form is shown and can be submitted
