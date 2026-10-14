export type UserId = string & { readonly __brand: 'UserId' };
export type TargetId = string & { readonly __brand: 'TargetId' };

export function asUserId(id: string): UserId {
  return id as UserId;
}

export function asTargetId(id: string): TargetId {
  return id as TargetId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
