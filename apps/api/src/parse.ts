import { DomainError } from '@beacon-watch/domain';
import type { ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'body');
      if (fields[key] === undefined) fields[key] = issue.message;
    }
    throw new DomainError('VALIDATION_FAILED', 'Invalid request', { fields });
  }
  return parsed.data;
}
