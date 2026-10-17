import { PUBLIC_RATE_LIMIT_WINDOW_SECONDS } from './keys.js';

export function rateLimitWindowStartSeconds(
  now: Date,
  windowSeconds: number = PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
): number {
  const epoch = Math.floor(now.getTime() / 1000);
  return Math.floor(epoch / windowSeconds) * windowSeconds;
}

export function rateLimitRemaining(limit: number, count: number): number {
  return Math.max(0, limit - count);
}

export function rateLimitAllowed(count: number, limit: number): boolean {
  return count <= limit;
}

export function rateLimitRetryAfterSeconds(
  ttlSeconds: number,
  windowSeconds: number = PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
): number {
  if (ttlSeconds > 0) return ttlSeconds;
  return windowSeconds;
}
