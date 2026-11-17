import { PUBLIC_RATE_LIMIT_WINDOW_SECONDS } from './keys.js';

export function rateLimitWindowCutoffMs(
  nowMs: number,
  windowMs: number = PUBLIC_RATE_LIMIT_WINDOW_SECONDS * 1000,
): number {
  return nowMs - windowMs;
}

export function rateLimitRemaining(limit: number, count: number): number {
  return Math.max(0, limit - count);
}

export function rateLimitAllowed(count: number, limit: number): boolean {
  return count <= limit;
}

export function rateLimitRetryAfterSeconds(
  oldestAdmittedMs: number,
  nowMs: number,
  windowMs: number = PUBLIC_RATE_LIMIT_WINDOW_SECONDS * 1000,
): number {
  const remainingMs = oldestAdmittedMs + windowMs - nowMs;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}
