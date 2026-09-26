# Error handling

## Model

- Expected failures are `DomainError` (`packages/domain/src/errors.ts`) with a **stable** `code` from `ERROR_CODES`.
- Anything else is a bug or an infrastructure failure. It is logged with its stack and surfaced as `INTERNAL`.
- Codes are part of the public API. Add new codes freely; never rename or repurpose one.

## HTTP mapping (API only; implemented in `apps/api/src/app.ts`)

| Code | HTTP | Typical cause |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Zod/domain rule failure; `details.fields` lists offending fields |
| `UNAUTHENTICATED` | 401 | Missing/expired session |
| `FORBIDDEN` | 403 | Authenticated but not the owner (FR-ERR-003) |
| `NOT_FOUND` | 404 | Unknown id, **or a private target accessed publicly** (never 403 on public routes, to avoid leaking existence) |
| `CONFLICT` | 409 | `public_slug` taken |
| `RATE_LIMITED` | 429 | Public API over quota; always with `Retry-After` |
| `DEPENDENCY_UNAVAILABLE` | 503 | Rate limiter cannot reach Redis (fail closed), DB down on `/readyz` |
| `INTERNAL` | 500 | Unexpected; message is always the generic `Internal server error` |

Response envelope (FR-ERR-001):

```json
{ "error": { "code": "CONFLICT", "message": "Slug already taken", "request_id": "…", "details": { "field": "public_slug" } } }
```

- Never include stack traces, SQL, driver messages, or upstream response bodies in responses.
- `message` is safe to show to end users; the web app may display it verbatim.
- Every response carries `x-request-id`; the same id appears in logs.

## Worker errors (FR-ERR-002)

- A probe failure is **data, not an exception**: the probe client returns `{ success: false, errorCode, errorMessage }` with codes
  `TIMEOUT`, `DNS`, `TLS`, `CONNECT`, `UNEXPECTED_STATUS`, `BODY_TOO_LARGE`, `SSRF_BLOCKED`, `REDIRECT_LIMIT`.
- Each check runs inside its own `try/catch`; an unexpected throw is logged with `target_id`, recorded as `error_code = INTERNAL`,
  and the loop continues. One bad target can never crash the process or stall the pool.
- Infrastructure errors in the loop (DB unreachable) back off exponentially (1s → 30s cap) and log at `warn`, then `error` after 5 attempts.
- Unhandled rejections / uncaught exceptions: log at `fatal` and exit non-zero so the orchestrator restarts the process.

## Web errors

- Route-level `error.tsx` and `not-found.tsx` use the shared `StatePanel` (see [frontend-conventions.md](frontend-conventions.md)).
- API errors are rendered from `error.message`; unknown failures show a generic retryable message plus the `request_id`.
