import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { latestStatusTtlSeconds, statusPageKey, targetLatestKey, unwrapCacheValue } from '@beacon-watch/domain';
import type { DbPool } from '@beacon-watch/db';
import { persistCheck } from '../modules/scheduling/run-check.js';
import { openTestPool, requireDatabaseUrl, requireRedisUrl, resetDb, seedDueTarget } from '../test/harness.js';
import { createRedis, RedisCache } from './redis-cache.js';

const skip = !requireDatabaseUrl() || !requireRedisUrl();

function okOutcome() {
  return { success: true as const, statusCode: 200, latencyMs: 7, errorCode: null, errorMessage: null };
}

describe.skipIf(skip)('worker status cache', () => {
  let pool: DbPool;
  let redis: ReturnType<typeof createRedis>;
  let cache: RedisCache;
  const warnings: string[] = [];

  beforeAll(async () => {
    pool = await openTestPool();
    redis = createRedis({
      url: requireRedisUrl(),
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    await redis.connect();
    cache = new RedisCache(redis, { warn: (_obj, msg) => warnings.push(msg) });
  });

  beforeEach(async () => {
    await resetDb(pool);
    await redis.flushall();
    warnings.length = 0;
  });

  afterAll(async () => {
    redis.disconnect();
    await pool.end();
  });

  it('writes latest status and invalidates the status page after a check commit', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const target = await seedDueTarget(pool, now, {
      intervalSeconds: 60,
      isPublic: true,
      publicSlug: 'cache-demo',
    });
    await redis.set(statusPageKey('cache-demo'), '{"v":1,"name":"stale"}');
    const check = await persistCheck(pool, target.id, now, okOutcome(), cache);
    expect(check?.success).toBe(true);
    expect(await redis.get(statusPageKey('cache-demo'))).toBeNull();
    const raw = await redis.get(targetLatestKey(target.id));
    expect(raw).toBeTruthy();
    const payload = unwrapCacheValue<Record<string, unknown>>(JSON.parse(raw ?? 'null') as unknown);
    expect(payload).toMatchObject({
      status: 'up',
      last_checked_at: now.toISOString(),
      latency_ms: 7,
      success: true,
    });
    const ttl = await redis.ttl(targetLatestKey(target.id));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(latestStatusTtlSeconds(60));
  });

  it('still persists the check when Redis is unreachable and logs warn', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const target = await seedDueTarget(pool, now);
    const dead = createRedis({
      url: 'redis://127.0.0.1:9',
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    const deadWarnings: string[] = [];
    const deadCache = new RedisCache(dead, { warn: (_obj, msg) => deadWarnings.push(msg) });
    const check = await persistCheck(pool, target.id, now, okOutcome(), deadCache);
    expect(check?.success).toBe(true);
    expect(deadWarnings.some((msg) => msg === 'redis cache unavailable')).toBe(true);
    dead.disconnect();
  });
});
