import type { Redis } from 'ioredis';
import {
  DomainError,
  PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
  publicRateLimitKey,
  rateLimitAllowed,
  rateLimitRemaining,
  rateLimitRetryAfterSeconds,
  rateLimitWindowStartSeconds,
} from '@beacon-watch/domain';

const CONSUME_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(ip: string, now: Date): Promise<RateLimitDecision>;
}

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly windowSeconds: number = PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
  ) {}

  async consume(ip: string, now: Date): Promise<RateLimitDecision> {
    const windowStart = rateLimitWindowStartSeconds(now, this.windowSeconds);
    const key = publicRateLimitKey(ip, windowStart);
    let raw: unknown;
    try {
      raw = await this.redis.eval(CONSUME_LUA, 1, key, String(this.windowSeconds));
    } catch {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    if (!Array.isArray(raw) || raw.length < 2) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    const count = Number(raw[0]);
    const ttl = Number(raw[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    const allowed = rateLimitAllowed(count, this.limit);
    return {
      allowed,
      limit: this.limit,
      remaining: rateLimitRemaining(this.limit, count),
      retryAfterSeconds: allowed ? 0 : rateLimitRetryAfterSeconds(ttl, this.windowSeconds),
    };
  }
}
