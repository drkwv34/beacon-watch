/**
 * Stable, machine-readable error codes. Adding a code is fine; renaming one is a breaking API change.
 * HTTP mapping lives in apps/api, not here (see docs/architecture/error-handling.md).
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
