import type { UserId } from '@beacon-watch/domain';
import { listIncidentsForTarget, toPublicIncident, type DbPool } from '@beacon-watch/db';
import { loadOwnedTarget } from '../targets/ownership.js';

export class IncidentService {
  constructor(
    private readonly pool: DbPool,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listForTarget(userId: UserId, rawId: string): Promise<Record<string, unknown>[]> {
    const target = await loadOwnedTarget(this.pool, userId, rawId);
    const rows = await listIncidentsForTarget(this.pool, target.id);
    const now = this.now();
    return rows.map((row) => toPublicIncident(row, now));
  }
}
