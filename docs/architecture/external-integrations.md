# External integrations

beacon-watch's riskiest code talks to URLs chosen by users. This doc is the normative outbound HTTP policy (SRS FR-SCH-002, Appendix C).

## 1. The probe client is the only outbound HTTP client

- Lives in `apps/worker/src/probe/`. ESLint forbids `fetch`, `undici`, `axios`, `got`, `node-fetch`, and `node:http(s)` everywhere else in `apps/api`, `apps/worker`, and `packages/*`.
- Built on `undici` with a **dedicated `Agent`** (own connection pool, no global dispatcher changes).
- No cookie jar, no proxy env inheritance, no shared state between targets.

## 2. Mandatory limits

| Limit | Value | Notes |
| --- | --- | --- |
| Total timeout | `target.timeout_ms` (500–10000) | Hard cancel via `AbortSignal.timeout`; covers connect + headers + body |
| Connect timeout | `min(2000, timeout_ms)` | Set on the undici `Agent` |
| Response body | read at most **4096 bytes**, then abort and discard | `Content-Length` > limit is not a failure by itself; the body just isn't read further |
| Redirects | follow ≤ **3**, manually | Re-run the SSRF check on every hop; 4th redirect → `REDIRECT_LIMIT` |
| Request body | POST only, ≤ 8 KiB | Validated at target creation |
| User-Agent | `beacon-watch/1.0` | Always set; users cannot override it |
| TLS | verification **on** | `PROBE_INSECURE_TLS=true` exists only for local MITM debugging and is rejected when `NODE_ENV=production` |

Latency is measured with `performance.now()` from request start to response headers.

## 3. SSRF policy (`SSRF_PROTECTION=true`, the default)

1. Accept only `http:` and `https:` URLs, no userinfo, ports 1–65535.
2. Resolve DNS **once** in the probe, validate **every** returned address, then connect to the validated IP (pinning via a custom `lookup`) so a DNS rebind between check and connect cannot bypass the rule.
3. Block: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16` (incl. `169.254.169.254` metadata), `0.0.0.0/8`, `100.64.0.0/10`, `::1`, `::`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6 of the above, and metadata hostnames (`metadata.google.internal`, `metadata`).
4. Validate at target create/update (fast feedback, `VALIDATION_FAILED`) **and** at probe time (authoritative, `SSRF_BLOCKED`).
5. Compose sets `SSRF_PROTECTION=false` for the worker only, so `http://mock-target:8080` works on the Docker network. Production profiles must keep it `true`.

## 4. Failure semantics

- Every failure is returned as data (`{ success: false, errorCode, errorMessage }`); see [error-handling.md](error-handling.md#worker-errors-fr-err-002).
- **No retries inside a check.** Flakiness is handled by grace/recovery thresholds in the domain, not by hiding failures.
- No circuit breaker per target; the schedule interval already rate-limits each target. The per-host semaphore protects hosts shared by many targets.

## 5. Other integrations

| Dependency | Client | Timeouts / behavior |
| --- | --- | --- |
| Postgres | `pg` Pool | `connectionTimeoutMillis: 5000`, `statement_timeout` 5s for request paths; worker backs off on outage |
| Redis | one client per process | Command timeout 500 ms; offline queue **disabled** so calls fail fast; see [caching-and-rate-limits.md](caching-and-rate-limits.md) for fail-open/closed rules |
| Web → API | server-side `fetch` in Next.js server components only | 5s timeout; base URL from `API_BASE_URL`; never exposes internal URLs to the browser |
| Alerting webhooks | out of scope for MVP (SRS §10) | If added later, reuse the probe client's limits and SSRF policy |

## 6. Tests

- Only `mock-target` is probed in CI; real third-party hosts are never contacted.
- Unit: SSRF IP classifier table (IPv4, IPv6, mapped, rebinding), redirect counting, body cap.
- Integration: slow endpoint → `TIMEOUT` without stalling other checks; oversized body → still classified by status; redirect loop → `REDIRECT_LIMIT`.
