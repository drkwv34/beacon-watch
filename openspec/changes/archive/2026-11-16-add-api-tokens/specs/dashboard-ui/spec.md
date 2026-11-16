# Spec Delta

## ADDED Requirements

### Requirement: FR-AUTH-003 Token manager UI
The dashboard SHALL offer a tokens page where the owner can create a labelled token, see the secret only on that create response, list prefixes and metadata without secrets, and revoke a token.

#### Scenario: Secret shown once then gone
- **WHEN** the owner creates a token on `/dashboard/tokens`
- **THEN** the page shows the full secret once with a warning, and after a reload or revoke the secret is not shown

#### Scenario: Owner can revoke from the UI
- **WHEN** the owner revokes a listed token
- **THEN** that token disappears from the list or is marked revoked and a later API call with its secret returns 401
