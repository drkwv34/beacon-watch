/** Advance next_check_at by interval plus jitter in [0, 10%] of the interval. `random` returns [0, 1]. */
export function computeNextCheckAt(now: Date, intervalSeconds: number, random: () => number): Date {
  const intervalMs = intervalSeconds * 1000;
  const jitterMs = Math.floor(random() * 0.1 * intervalMs);
  return new Date(now.getTime() + intervalMs + jitterMs);
}

/** Floor on lease grace so a short timeout still covers per-host semaphore wait. */
export const PROBE_LEASE_MIN_GRACE_MS = 30_000;

/**
 * Lease expiry from `now`: probe `timeoutMs` plus grace of at least 3× timeout
 * (or 30s) so queued claims behind PROBE_MAX_PER_HOST can finish without the
 * row becoming free mid-wait.
 */
export function computeProbeLeaseExpiry(now: Date, timeoutMs: number): Date {
  const graceMs = Math.max(PROBE_LEASE_MIN_GRACE_MS, timeoutMs * 3);
  return new Date(now.getTime() + timeoutMs + graceMs);
}

export function probeLeaseIsActive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}
