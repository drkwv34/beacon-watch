# Specs (current truth)

One folder per capability, each with a `spec.md` describing behavior that is **shipped on `main`**. Requirements appear here only after a change that implements them is merged and archived.

| Capability | Folder | SRS requirements | Status |
| --- | --- | --- | --- |
| Auth and sessions | `auth/` | FR-AUTH-001..002, NFR-SEC-001 | Register/login/logout, Argon2id, Postgres sessions, CSRF; FR-AUTH-003 API tokens is Should |
| Targets | `targets/` | FR-TGT-001..003, FR-ERR-003 | CRUD, pause, hard delete, create-time SSRF, empty dashboard |
| Scheduling | `scheduling/` | FR-SCH-001, FR-SCH-003..005, NFR-PERF-002 | SKIP LOCKED claim, jitter lease, check persist, probe semaphores |
| Probe | `probe/` | FR-SCH-002, Appendix C, NFR-SEC-001, FR-ERR-002 | Isolated worker client, timeouts, 4 KiB cap, ≤3 redirects, probe-time SSRF |
| Incidents | `incidents/` | FR-INC-001..004, Appendix B, NFR-REL-002 | Grace/recovery machine, same-tx persist, owner timeline |
| Caching | `caching/` | FR-CACHE-001..003, NFR-REL-001 | Redis latest/statuspage keys; Postgres fallback; NFR-PERF-001 p95 is a local bench, not a CI gate |
| Public API | `public-api/` | FR-PUB-003..005, NFR-SEC-002 | Appendix A JSON, identical 404, per-IP 429, fail-closed limiter, CORS |
| Dashboard and status HTML | `dashboard-ui/` | FR-UI-001..004, FR-PUB-001..002, NFR-A11Y-001 | Labelled badges, Check now, `/s/[slug]`, empty states |
| Quality / CI | `quality/` | NFR-MAINT-001, NFR-PORT-001 (e2e) | Vitest pyramid + Compose Playwright including flap |
| Portfolio demo | `portfolio/` | NFR-PORT-001, SRS §9 / §4.4, Appendix D | Seed, `scripts/demo-flap.sh`, README, screenshots |

Observability (NFR-OBS-001 check logs, FR-ERR-001 envelope) is specified in `docs/architecture/` rather than a capability folder. NFR-OBS-002 Prometheus `/metrics` is Should.

## Suggested change order

1. ~~`add-auth-targets`~~ archived 2026-10-14.
2. ~~`add-scheduler-probes`~~ archived 2026-10-15.
3. ~~`add-incident-thresholds`~~ archived 2026-10-16.
4. ~~`add-cache-public-ratelimit`~~ archived 2026-10-17.
5. ~~`add-ui-status-dashboard`~~ archived 2026-10-18.
6. ~~`restore-e2e-ci`~~ archived 2026-10-18.
7. ~~`add-test-ci-hardening`~~ archived 2026-10-19.
8. ~~`add-readme-demo-flap`~~ archived 2026-10-20.
9. ~~`add-pin-ready-closeout`~~ archived 2026-10-21.

Format for a capability `spec.md`:

```markdown
# <capability> Specification

## Purpose
One paragraph.

## Requirements

### Requirement: FR-XXX-000 Short title
The system SHALL ...

#### Scenario: Descriptive name
- **WHEN** ...
- **THEN** ...
```
