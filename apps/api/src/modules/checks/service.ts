import type { UserId } from '@beacon-watch/domain';
import { listChecksForTarget, toPublicCheck, type DbPool } from '@beacon-watch/db';
import { loadOwnedTarget } from '../targets/ownership.js';

export class CheckService {
  constructor(private readonly pool: DbPool) {}

  async listForTarget(userId: UserId, rawId: string, limit: number): Promise<Record<string, unknown>[]> {
    const target = await loadOwnedTarget(this.pool, userId, rawId);
    const rows = await listChecksForTarget(this.pool, target.id, { limit });
    return rows.map(toPublicCheck);
  }
}
