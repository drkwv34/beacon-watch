export type UserId = string & { readonly __brand: 'UserId' };
export type TargetId = string & { readonly __brand: 'TargetId' };
export type CheckId = string & { readonly __brand: 'CheckId' };
export type IncidentId = string & { readonly __brand: 'IncidentId' };

export function asUserId(id: string): UserId {
  return id as UserId;
}

export function asTargetId(id: string): TargetId {
  return id as TargetId;
}

export function asCheckId(id: string): CheckId {
  return id as CheckId;
}

export function asIncidentId(id: string): IncidentId {
  return id as IncidentId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
