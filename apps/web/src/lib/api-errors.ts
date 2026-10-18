import type { ApiErrorBody } from './types';

export function fieldErrorsFromApi(status: number, body: unknown): { form?: string; fields: Record<string, string> } {
  const payload = body as ApiErrorBody | null;
  const fields: Record<string, string> = { ...(payload?.error?.details?.fields ?? {}) };
  const message = payload?.error?.message;
  if (status === 409 && payload?.error?.details?.field) {
    fields[payload.error.details.field] = message ?? 'Already taken';
  }
  if (Object.keys(fields).length > 0) return { fields };
  return { form: message ?? 'Could not save', fields };
}

export function firstInvalidField(fields: Record<string, string>, order: string[]): string | undefined {
  return order.find((name) => fields[name] !== undefined) ?? Object.keys(fields)[0];
}
