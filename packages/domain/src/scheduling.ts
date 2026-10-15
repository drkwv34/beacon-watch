/** Advance next_check_at by interval plus jitter in [0, 10%] of the interval. `random` returns [0, 1]. */
export function computeNextCheckAt(now: Date, intervalSeconds: number, random: () => number): Date {
  const intervalMs = intervalSeconds * 1000;
  const jitterMs = Math.floor(random() * 0.1 * intervalMs);
  return new Date(now.getTime() + intervalMs + jitterMs);
}
