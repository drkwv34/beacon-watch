import { DomainError, STATUS_PAGE_TTL_SECONDS, type PublicStatusPayload } from '@beacon-watch/domain';
import { loadPublicStatusBySlug, type DbPool } from '@beacon-watch/db';
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
    const payload = await loadPublicStatusBySlug(this.pool, slug, this.now());
    if (!payload) throw new DomainError('NOT_FOUND', NOT_FOUND_MESSAGE);
    return payload;
  }
}
