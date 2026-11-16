import { DomainError, asTargetId, isUuid, type UserId } from '@beacon-watch/domain';
import { findTargetById, type DbPool, type TargetRow } from '@beacon-watch/db';

export function requireTargetId(id: string) {
  if (!isUuid(id)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target id', { fields: { id: 'must be a uuid' } });
  }
  return asTargetId(id);
}

export async function loadOwnedTarget(pool: DbPool, userId: UserId, rawId: string): Promise<TargetRow> {
  const id = requireTargetId(rawId);
  const row = await findTargetById(pool, id);
  if (!row) throw new DomainError('NOT_FOUND', 'Target not found');
  if (row.userId !== userId) throw new DomainError('FORBIDDEN', 'Not the target owner');
  return row;
}
