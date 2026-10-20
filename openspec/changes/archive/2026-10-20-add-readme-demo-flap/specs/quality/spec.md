# Spec Delta

## ADDED Requirements

### Requirement: NFR-PORT-001 Compose flap e2e
`pnpm test:e2e` on the Compose `--wait` job MUST seed Appendix D data (or equivalent test-profile env with shortened interval/grace only in that profile) and prove the `demo` public monitor goes Down and opens an incident after mock-target returns 500, then goes Up and resolves after restore. Product interval and grace defaults MUST stay 60s and 2.

#### Scenario: Red then green
- **WHEN** the e2e job has Compose up, seed applied, and the mock flipped to 500 then restored
- **THEN** `/s/demo` shows Down with an open incident while failing, then Up with the incident resolved after restore

#### Scenario: Product defaults unchanged
- **WHEN** the apps boot without the e2e/seed profile overrides
- **THEN** new targets still default to interval 60 seconds and grace/recovery 2
