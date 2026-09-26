# Logging and observability

## Logs

- **pino JSON to stdout**, one line per event. No `console.*` in app code (lint-enforced); `mock-target` is exempt.
- **Levels:** `fatal` process must exit · `error` needs a human (unexpected exception, persistent dependency outage) ·
  `warn` degraded but handled (Redis down → DB fallback, retrying DB) · `info` lifecycle and one line per request/check · `debug` diagnostics, off in prod.
- **Correlation:** API uses `request_id` (from `x-request-id` or generated UUID, echoed in the response). The worker binds a child logger per check with `target_id` and `check_id`.
- **Required fields per check (NFR-OBS-001):** `target_id`, `check_id`, `latency_ms`, `success`, and `error_code` when failed.
- **Message style:** lowercase, static strings (`"check completed"`); variable data goes in fields, not interpolated into `msg`.

## Redaction

- Configured centrally (`REDACT_PATHS` in `apps/api/src/app.ts`): `authorization`, `cookie`, `set-cookie`.
- Never log: passwords, session ids, `SESSION_SECRET`, `DATABASE_URL`, target request headers/bodies, response bodies from probed targets.
- Log target URLs **without** query strings or userinfo (`https://host/path`), since users sometimes embed tokens in them.
- Config validation errors list invalid **keys**, never values.

## Health and metrics

- `GET /healthz`: liveness, no dependencies, always cheap.
- `GET /readyz`: checks Postgres and Redis and reports each (SRS §4.2). Postgres down → 503. Redis down → body marks it `degraded`; whether that is 200 or 503 is decided in the Day 5 caching change, given that status pages can still serve from Postgres.
- Metrics (NFR-OBS-002, Should): `checks_total{success}`, `check_latency_ms` histogram, `open_incidents` gauge, `public_api_rate_limited_total`. Exposed by the API at `/metrics` in Prometheus text format.
