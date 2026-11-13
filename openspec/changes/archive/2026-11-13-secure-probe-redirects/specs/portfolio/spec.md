# Spec Delta

## MODIFIED Requirements

### Requirement: SRS §4.4 env example
`.env.example` MUST document `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `SSRF_PROTECTION`, `SSRF_HOST_EXCEPTION`, `PUBLIC_RATE_LIMIT_PER_MIN`, `APP_BASE_URL`, `DEMO_PASSWORD`, and every other variable the apps already read, using non-secret placeholders. Comments MUST state that Compose keeps worker protection on with an exact hostname exception, and that `SSRF_PROTECTION=false` is only explicit local debugging.

#### Scenario: Required keys are present
- **WHEN** a reviewer opens `.env.example`
- **THEN** those named keys exist with placeholders and comments that the Compose worker keeps SSRF protection on, using an exact `mock-target` hostname exception so probes can reach the demo on the Docker network
