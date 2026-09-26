export const TARGET_STATUSES = ['up', 'down', 'unknown'] as const;

export type TargetStatus = (typeof TARGET_STATUSES)[number];

/** UI-facing status; `paused` is derived from `enabled=false`, never persisted as `last_status`. */
export type DisplayStatus = TargetStatus | 'paused';

export function isTargetStatus(value: unknown): value is TargetStatus {
  return typeof value === 'string' && (TARGET_STATUSES as readonly string[]).includes(value);
}
