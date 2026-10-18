import { DomainError, asTargetId, isUuid, type UserId } from '@beacon-watch/domain';
import { findTargetById, listChecksForTarget, toPublicCheck, type DbPool } from '@beacon-watch/db';

function requireTargetId(id: string) {
  if (!isUuid(id)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target id', { fields: { id: 'must be a uuid' } });
  }
  return asTargetId(id);
}

export class CheckService {
  constructor(private readonly pool: DbPool) {}

  async listForTarget(userId: UserId, rawId: string, limit: number): Promise<Record<string, unknown>[]> {
    const id = requireTargetId(rawId);
    const target = await findTargetById(this.pool, id);
    if (!target) throw new DomainError('NOT_FOUND', 'Target not found');
    if (target.userId !== userId) throw new DomainError('FORBIDDEN', 'Not the target owner');
    const rows = await listChecksForTarget(this.pool, id, { limit });
    return rows.map(toPublicCheck);
  }
}
