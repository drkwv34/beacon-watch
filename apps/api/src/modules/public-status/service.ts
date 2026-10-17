import {
  DomainError,
  STATUS_PAGE_TTL_SECONDS,
  publicDisplayStatus,
  uptime24h,
  type PublicStatusPayload,
} from '@beacon-watch/domain';
import {
  countChecksSince,
  findLatestCheck,
  findOpenIncident,
  findPublicTargetBySlug,
  type DbPool,
} from '@beacon-watch/db';
import type { RedisCache } from '../../cache/redis-cache.js';

const NOT_FOUND_MESSAGE = 'Status page not found';

export class PublicStatusService {
  constructor(
    private readonly pool: DbPool,
    private readonly cache: RedisCache | undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getBySlug(slug: string): Promise<PublicStatusPayload> {
    const cached = await this.cache?.getStatusPage(slug);
    if (cached) return cached;
    const payload = await this.loadFromDb(slug);
    await this.cache?.setStatusPage(slug, payload, STATUS_PAGE_TTL_SECONDS);
    return payload;
  }

  /** Postgres path used when the cache misses or Redis is down (FR-CACHE-003). */
  async loadFromDb(slug: string): Promise<PublicStatusPayload> {
    const target = await findPublicTargetBySlug(this.pool, slug);
    if (!target) throw new DomainError('NOT_FOUND', NOT_FOUND_MESSAGE);
    const now = this.now();
    const latest = await findLatestCheck(this.pool, target.id);
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const counts = await countChecksSince(this.pool, target.id, since);
    const open = await findOpenIncident(this.pool, target.id);
    const durationSeconds = open ? Math.max(0, Math.floor((now.getTime() - open.openedAt.getTime()) / 1000)) : 0;
    return {
      name: target.name,
      status: publicDisplayStatus(target.enabled, target.lastStatus),
      last_checked_at: target.lastCheckedAt ? target.lastCheckedAt.toISOString() : null,
      latency_ms: latest?.latencyMs ?? null,
      uptime_24h: uptime24h(counts.successes, counts.total),
      open_incident: open ? { opened_at: open.openedAt.toISOString(), duration_seconds: durationSeconds } : null,
    };
  }
}
