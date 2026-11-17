import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainError, publicRateLimitKey } from '@beacon-watch/domain';
import { RedisRateLimiter } from './rate-limiter.js';
import { createRedis } from './redis-cache.js';
import { requireRedisUrl } from '../test/harness.js';

const skip = !requireRedisUrl();

describe('public rate limiter window math', () => {
  it('exposes an IP-only sliding-window key', () => {
    expect(publicRateLimitKey('203.0.113.10')).toBe('ratelimit:public:203.0.113.10');
  });
});

describe.skipIf(skip)('RedisRateLimiter sliding window', () => {
  const redis = createRedis({
    url: requireRedisUrl(),
    connectTimeoutMs: 200,
    commandTimeoutMs: 200,
  });

  beforeAll(async () => {
    await redis.connect();
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('keeps 429 after a Unix minute boundary until the oldest admission expires', async () => {
    const limiter = new RedisRateLimiter(redis, 3);
    const nearBoundary = new Date('2026-11-16T17:25:58.000Z');
    const ip = '198.51.100.10';
    for (let i = 0; i < 3; i += 1) {
      const admitted = await limiter.consume(ip, nearBoundary);
      expect(admitted.allowed).toBe(true);
    }
    const limited = await limiter.consume(ip, nearBoundary);
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBe(60);

    const justAfterMinute = new Date('2026-11-16T17:26:00.000Z');
    const stillLimited = await limiter.consume(ip, justAfterMinute);
    expect(stillLimited.allowed).toBe(false);
    expect(stillLimited.retryAfterSeconds).toBe(58);

    const firstSlotFrees = new Date(nearBoundary.getTime() + 60_000);
    const admitted = await limiter.consume(ip, firstSlotFrees);
    expect(admitted.allowed).toBe(true);
  });

  it('sets Retry-After to the seconds until the next admission', async () => {
    const limiter = new RedisRateLimiter(redis, 1);
    const now = new Date('2026-11-16T12:00:00.400Z');
    expect((await limiter.consume('198.51.100.11', now)).allowed).toBe(true);
    const limited = await limiter.consume('198.51.100.11', now);
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBe(60);
    const almostFree = new Date(now.getTime() + 59_700);
    const waiting = await limiter.consume('198.51.100.11', almostFree);
    expect(waiting.allowed).toBe(false);
    expect(waiting.retryAfterSeconds).toBe(1);
  });

  it('admits 60 concurrent requests and rejects the 61st without a per-process cap', async () => {
    const limiter = new RedisRateLimiter(redis, 60);
    const now = new Date('2026-11-16T12:00:00.000Z');
    const ip = '198.51.100.12';
    const results = await Promise.all(Array.from({ length: 61 }, () => limiter.consume(ip, now)));
    expect(results.filter((row) => row.allowed).length).toBe(60);
    expect(results.filter((row) => !row.allowed).length).toBe(1);
    const rejected = results.find((row) => !row.allowed);
    expect(rejected?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(await redis.zcard(publicRateLimitKey(ip))).toBe(60);
  });

  it('isolates IPs and honors a configured limit', async () => {
    const limiter = new RedisRateLimiter(redis, 2);
    const now = new Date('2026-11-16T12:00:00.000Z');
    expect((await limiter.consume('198.51.100.13', now)).allowed).toBe(true);
    expect((await limiter.consume('198.51.100.13', now)).allowed).toBe(true);
    expect((await limiter.consume('198.51.100.13', now)).allowed).toBe(false);
    expect((await limiter.consume('198.51.100.14', now)).allowed).toBe(true);
  });

  it('does not store rejected requests as admissions', async () => {
    const limiter = new RedisRateLimiter(redis, 1);
    const now = new Date('2026-11-16T12:00:00.000Z');
    const ip = '198.51.100.15';
    expect((await limiter.consume(ip, now)).allowed).toBe(true);
    for (let i = 0; i < 20; i += 1) {
      expect((await limiter.consume(ip, now)).allowed).toBe(false);
    }
    expect(await redis.zcard(publicRateLimitKey(ip))).toBe(1);
  });

  it('fails closed when Redis is unreachable', async () => {
    const dead = createRedis({
      url: 'redis://127.0.0.1:9',
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    const limiter = new RedisRateLimiter(dead, 60);
    await expect(limiter.consume('198.51.100.16', new Date())).rejects.toSatisfy(
      (err: unknown) => err instanceof DomainError && err.code === 'DEPENDENCY_UNAVAILABLE',
    );
    dead.disconnect();
  });
});
