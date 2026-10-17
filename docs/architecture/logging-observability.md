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
- `GET /readyz`: checks Postgres and Redis and reports each (SRS §4.2). Postgres down → 503. Redis down → 200 `{ status: 'degraded', postgres: 'ok', redis: 'unavailable' }` because checks and authenticated routes still work; the public JSON limiter still fails closed with 503 on that path.
- Metrics (NFR-OBS-002, Should): `checks_total{success}`, `check_latency_ms` histogram, `open_incidents` gauge, `public_api_rate_limited_total`. Exposed by the API at `/metrics` in Prometheus text format.
