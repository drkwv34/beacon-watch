import { Redis } from 'ioredis';
import {
  latestStatusTtlSeconds,
  statusPageKey,
  targetLatestKey,
  unwrapCacheValue,
  wrapCacheValue,
  type LatestStatusPayload,
  type PublicStatusPayload,
  type TargetStatus,
} from '@beacon-watch/domain';

export interface CacheLogger {
  warn: (obj: object, msg: string) => void;
}

export interface RedisOptions {
  url: string;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
}

export function createRedis(opts: RedisOptions): Redis {
  const redis = new Redis(opts.url, {
    lazyConnect: true,
    connectTimeout: opts.connectTimeoutMs,
    commandTimeout: opts.commandTimeoutMs,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(200 * times, 2000);
    },
  });
  redis.on('error', () => {
    // Command rejections surface to callers; avoid crashing on socket errors.
  });
  return redis;
}

export class RedisCache {
  constructor(
    private readonly redis: Redis,
    private readonly log: CacheLogger,
  ) {}

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return unwrapCacheValue(JSON.parse(raw) as unknown) as T | undefined;
    } catch (err) {
      this.log.warn({ err }, 'redis cache unavailable');
      return undefined;
    }
  }

  async setJson(key: string, value: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(wrapCacheValue(value)), 'EX', ttlSeconds);
    } catch (err) {
      this.log.warn({ err }, 'redis cache unavailable');
    }
  }

  async del(...keys: string[]): Promise<void> {
    const unique = [...new Set(keys.filter((key) => key.length > 0))];
    if (unique.length === 0) return;
    try {
      await this.redis.del(...unique);
    } catch (err) {
      this.log.warn({ err }, 'redis cache unavailable');
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async writeLatest(input: {
    targetId: string;
    intervalSeconds: number;
    status: TargetStatus;
    lastCheckedAt: Date;
    latencyMs: number | null;
    success: boolean;
  }): Promise<void> {
    const payload: LatestStatusPayload = {
      status: input.status,
      last_checked_at: input.lastCheckedAt.toISOString(),
      latency_ms: input.latencyMs,
      success: input.success,
    };
    await this.setJson(
      targetLatestKey(input.targetId),
      payload as unknown as Record<string, unknown>,
      latestStatusTtlSeconds(input.intervalSeconds),
    );
  }

  async invalidateStatusPage(slug: string | null | undefined): Promise<void> {
    if (slug) await this.del(statusPageKey(slug));
  }

  async invalidateTarget(targetId: string, slugs: Array<string | null | undefined>): Promise<void> {
    const keys = [targetLatestKey(targetId)];
    for (const slug of slugs) {
      if (slug) keys.push(statusPageKey(slug));
    }
    await this.del(...keys);
  }

  async getStatusPage(slug: string): Promise<PublicStatusPayload | undefined> {
    return this.getJson<PublicStatusPayload>(statusPageKey(slug));
  }

  async setStatusPage(slug: string, payload: PublicStatusPayload, ttlSeconds: number): Promise<void> {
    await this.setJson(statusPageKey(slug), payload as unknown as Record<string, unknown>, ttlSeconds);
  }
}
