export const STATUS_PAGE_TTL_SECONDS = 15;
export const LATEST_STATUS_MIN_TTL_SECONDS = 120;
export const PUBLIC_RATE_LIMIT_WINDOW_SECONDS = 60;
export const PUBLIC_RATE_LIMIT_DEFAULT_PER_MIN = 60;
export const CACHE_VALUE_VERSION = 1 as const;

export function targetLatestKey(targetId: string): string {
  return `target:${targetId}:latest`;
}

export function statusPageKey(slug: string): string {
  return `statuspage:${slug}`;
}

export function publicRateLimitKey(ip: string, windowStartSeconds: number): string {
  return `ratelimit:public:${ip}:${windowStartSeconds}`;
}

/** TTL for `target:{id}:latest` is max(2 × interval, 120s). */
export function latestStatusTtlSeconds(intervalSeconds: number): number {
  return Math.max(2 * intervalSeconds, LATEST_STATUS_MIN_TTL_SECONDS);
}
