# Tasks

## 1. Failing regression coverage

- [x] 1.1 Add a two-worker scheduler integration test: six slow targets, host max 2, global permits ≥ 6, barriers (no arbitrary sleeps) around claim/queue/probe, check-now during the in-flight window; assert exactly one probe and one check row per target, peak per-host ≤ 2, and all six complete. Verify it fails on current main with duplicate first ids.
- [x] 1.2 Change owner+CSRF check-now assertions to HTTP 202 with the public target envelope, keep 401/403 CSRF/non-owner and 404, and add paused (202, still disabled, never claimed). Verify owner+CSRF fails on current main because the route returns 200.

## 2. Schema and domain lease

- [x] 2.1 Add forward-only `packages/db/migrations/0004_target_probe_leases.sql` (`probe_lease_token`, `probe_lease_expires_at`, `manual_check_requested`) and map the columns on `TargetRow` without exposing them in `toPublicTarget`. Verify migrate applies on the test database.
- [x] 2.2 Add pure `computeProbeLeaseExpiry` (timeout plus grace covering semaphore wait) next to `computeNextCheckAt` with unit tests for bounds, and verify `pnpm --filter @beacon-watch/domain test` covers both helpers.

## 3. Claim, check-now, finalize

- [x] 3.1 Change `claimDueTargets` to SKIP LOCKED excluding active leases, include `manual_check_requested`, stamp token+expiry, clear the signal, and not rewrite `next_check_at`. Verify `claim.int.test.ts` (two connections, disabled skip, active lease excluded, expired lease reclaimable).
- [x] 3.2 Implement check-now coalescing in `TargetService` (idle advances due + signal; in-flight leaves the lease; paused is a no-op) and `reply.status(202)` in the route. Verify 1.2 plus idle-advances-due pass.
- [x] 3.3 Token-guard persist/finalize from completion (interval+jitter), lease renewal while waiting on the per-host semaphore, drop work when renewal fails. Verify 1.1 is green, stale-token persist does not clobber a newer lease, and paused targets still produce zero checks.

## 4. Docs

- [x] 4.1 Update README scheduling hard edge, `docs/architecture/transactionality.md`, and `.cursor/rules/worker-probe.mdc` to describe explicit leases, coalesced check-now, 202, and completion-based reschedule. Verify the docs match the implemented claim/finalize flow.

## Workflow follow-up

- Archive this change after merge to `main`.
