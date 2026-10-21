# Should-scope backlog (proposal-only)

This note records **Should**-priority SRS items that are **not** in the v0.1.0 pin. It is an OpenSpec backlog, not a change to implement.

**Do not implement any item here** without a new OpenSpec change (`openspec new change …`) that is reviewed and applied separately. Day 9 `add-pin-ready-closeout` records this list only.

Sources: archived change proposals under `openspec/changes/archive/` and capability status in `openspec/specs/README.md`.

| ID / name | Summary | Recorded in |
| --- | --- | --- |
| FR-AUTH-003 | API tokens. Auth is email/password + Postgres sessions only. | `openspec/changes/archive/2026-10-14-add-auth-targets/proposal.md`; `openspec/specs/auth/spec.md` |
| NFR-OBS-002 | Prometheus `/metrics` (`checks_total`, `check_latency_ms`, `open_incidents`, `public_api_rate_limited_total`). NFR-OBS-001 check logs are Must and shipped. | `docs/architecture/logging-observability.md` |
| Latency sparkline | Dashboard sparkline of recent latencies. Day 6 skipped it. | `openspec/changes/archive/2026-10-18-add-ui-status-dashboard/proposal.md` |
| Alerts | Slack, email, or PagerDuty notifications. Out of MVP (SRS §10). | `README.md` Trade-offs; `docs/architecture/external-integrations.md` |
| Hosted deployment | No production host; Compose local + CI only. | Day 8/9 briefs; `openspec/changes/archive/2026-10-20-add-readme-demo-flap/proposal.md` |
| ICMP | HTTP(S) probes only. | `openspec/changes/archive/2026-10-19-add-test-ci-hardening/proposal.md` |
| Soak / multi-day history | Checks persist; no retention sweeper or multi-day soak job. | same archive proposal |
| NFR-PERF-001 CI gate | Warm-cache public status p95 ≤ 100ms. Local `scripts/bench-public-status.ts` exists; Day 5 design kept it out of CI. | `openspec/changes/archive/2026-10-17-add-cache-public-ratelimit/design.md` |
| Browser synthetics vs real hosts | Tests use `mock-target` only. | `docs/architecture/testing-strategy.md`; NFR-MAINT-001 |

Must-scope capabilities already specified under `openspec/specs/` (auth, targets, scheduling, probe, incidents, caching, public-api, dashboard-ui, quality, portfolio) remain the pin contract.

None of the rows above are implemented by `add-pin-ready-closeout`.
