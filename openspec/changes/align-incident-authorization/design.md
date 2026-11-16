# Design

## Context

See proposal.md for motivation. `IncidentService.listForTarget` currently treats `!target || target.userId !== userId` as `NOT_FOUND`. `TargetService` already splits those cases via `loadOwned` (`NOT_FOUND` vs `FORBIDDEN`). `CheckService.listForTarget` already matches that mapping inline. Public `/api/public/v1` and `/s/[slug]` stay 404 for private/missing (NFR-SEC-001). This change is authenticated-API only.

## Goals / Non-Goals

**Goals:**

- One ownership mapping on authenticated target-scoped reads: missing → 404, other owner → 403, invalid UUID → 400, no session → 401 (existing gate).
- Keep the incident list payload and ordering unchanged for the owner.

**Non-Goals:**

- Changing public 404-for-private.
- API tokens (separate change).
- Broad service refactor beyond a small shared `loadOwned` helper if both checks and incidents consume it.

## Decisions

### 1. Reuse the TargetService ownership split

Extract `loadOwnedTarget(pool, userId, rawId)` next to targets (`apps/api/src/modules/targets/ownership.ts`) and call it from targets, checks, and incidents. Rejected: duplicating the if/throw in incidents only (drift), or returning 404 for non-owners (contradicts FR-ERR-003 on authenticated routes).

### 2. Error envelope unchanged

`FORBIDDEN` already maps to HTTP 403 in `apps/api/src/app.ts`. Message: `Not the target owner`. No timeline key in the body. `x-request-id` is already echoed.

### 3. Tests first

Replace the incidents int test that expects 404 for a non-owner with 403 + `request_id` + no `items`. Keep 404 for a random UUID. Add owner 200, unauthenticated 401, and invalid UUID 400. Capture the non-owner case failing on current main (404 vs 403) before the service change.

## Risks / Trade-offs

- [403 leaks that a target id exists] → accepted for authenticated routes (same as targets/checks, FR-ERR-003). Public routes stay 404.
- [Clients that treated non-owner as 404] → **BREAKING** for those clients; documented in the proposal.

## Migration Plan

Forward-only; no schema. Deploy the API. Rollback is a revert of the service mapping.

## Open Questions

None.
