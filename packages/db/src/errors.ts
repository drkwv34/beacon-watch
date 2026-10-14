import { DomainError } from '@beacon-watch/domain';

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  const pgErr = err as { code: unknown; constraint?: unknown };
  if (pgErr.code !== '23505') return false;
  if (constraint === undefined) return true;
  return pgErr.constraint === constraint;
}

export function conflictIfUnique(err: unknown, _constraint: string, message: string, field: string): never {
  if (isUniqueViolation(err)) {
    throw new DomainError('CONFLICT', message, { field });
  }
  throw err;
}
