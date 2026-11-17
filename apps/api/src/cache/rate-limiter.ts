import type { Redis } from 'ioredis';
import {
  DomainError,
  PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
  publicRateLimitKey,
  rateLimitRemaining,
  rateLimitRetryAfterSeconds,
} from '@beacon-watch/domain';

const CONSUME_LUA = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff)
local count = redis.call('ZCARD', KEYS[1])
if count < limit then
  redis.call('ZADD', KEYS[1], now, member)
  redis.call('PEXPIRE', KEYS[1], window)
  return {1, count + 1, 0}
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local oldestScore = 0
if oldest[2] then
  oldestScore = tonumber(oldest[2])
end
redis.call('PEXPIRE', KEYS[1], window)
return {0, count, oldestScore}
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
    const nowMs = now.getTime();
    const windowMs = this.windowSeconds * 1000;
    const key = publicRateLimitKey(ip);
    let raw: unknown;
    try {
      raw = await this.redis.eval(
        CONSUME_LUA,
        1,
        key,
        String(nowMs),
        String(windowMs),
        String(this.limit),
        crypto.randomUUID(),
      );
    } catch {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    if (!Array.isArray(raw) || raw.length < 3) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    const allowedFlag = Number(raw[0]);
    const count = Number(raw[1]);
    const oldestMs = Number(raw[2]);
    if (!Number.isFinite(allowedFlag) || !Number.isFinite(count) || !Number.isFinite(oldestMs)) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    const allowed = allowedFlag === 1;
    return {
      allowed,
      limit: this.limit,
      remaining: allowed ? rateLimitRemaining(this.limit, count) : 0,
      retryAfterSeconds: allowed ? 0 : rateLimitRetryAfterSeconds(oldestMs, nowMs, windowMs),
    };
  }
}
