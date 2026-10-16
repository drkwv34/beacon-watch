import { DomainError, asTargetId, isUuid, type UserId } from '@beacon-watch/domain';
import { findTargetById, listIncidentsForTarget, toPublicIncident, type DbPool } from '@beacon-watch/db';

function requireTargetId(id: string) {
  if (!isUuid(id)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target id', { fields: { id: 'must be a uuid' } });
  }
  return asTargetId(id);
}

export class IncidentService {
  constructor(
    private readonly pool: DbPool,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listForTarget(userId: UserId, rawId: string): Promise<Record<string, unknown>[]> {
    const id = requireTargetId(rawId);
    const target = await findTargetById(this.pool, id);
    if (!target || target.userId !== userId) {
      throw new DomainError('NOT_FOUND', 'Target not found');
    }
    const rows = await listIncidentsForTarget(this.pool, id);
    const now = this.now();
    return rows.map((row) => toPublicIncident(row, now));
  }
}
