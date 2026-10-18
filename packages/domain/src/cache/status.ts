import type { IncidentStatus } from '../incidents/machine.js';
import type { DisplayStatus, TargetStatus } from '../target-status.js';
import { CACHE_VALUE_VERSION } from './keys.js';

export interface PublicOpenIncident {
  opened_at: string;
  duration_seconds: number;
}

export interface PublicRecentIncident {
  opened_at: string;
  resolved_at: string | null;
  duration_seconds: number;
  status: IncidentStatus;
}

export interface PublicStatusPayload {
  name: string;
  status: DisplayStatus;
  last_checked_at: string | null;
  latency_ms: number | null;
  uptime_24h: number | null;
  open_incident: PublicOpenIncident | null;
  check_count: number;
  ever_succeeded: boolean;
  recent_incidents: PublicRecentIncident[];
}

export const PUBLIC_STATUS_NOTICE = {
  paused: 'Monitoring is paused',
  starting: 'Monitoring starting…',
  never_succeeded: 'No successful checks yet.',
} as const;

export type PublicStatusNoticeKind = keyof typeof PUBLIC_STATUS_NOTICE;

/** Pick FR-PUB-002 copy; paused wins over empty/never-succeeded. */
export function selectPublicStatusNotice(input: {
  status: DisplayStatus;
  check_count: number;
  ever_succeeded: boolean;
}): PublicStatusNoticeKind | null {
  if (input.status === 'paused') return 'paused';
  if (input.check_count <= 0) return 'starting';
  if (!input.ever_succeeded) return 'never_succeeded';
  return null;
}

export interface LatestStatusPayload {
  status: TargetStatus;
  last_checked_at: string;
  latency_ms: number | null;
  success: boolean;
}

export type Versioned<T extends Record<string, unknown>> = { v: typeof CACHE_VALUE_VERSION } & T;

/** Share of successful checks; null when there are none. */
export function uptime24h(successCount: number, totalCount: number): number | null {
  if (totalCount <= 0) return null;
  return successCount / totalCount;
}

export function wrapCacheValue<T extends Record<string, unknown>>(payload: T): Versioned<T> {
  return { v: CACHE_VALUE_VERSION, ...payload };
}

export function unwrapCacheValue<T extends Record<string, unknown>>(raw: unknown): T | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  if (record.v !== CACHE_VALUE_VERSION) return undefined;
  const rest = { ...record };
  delete rest.v;
  return rest as T;
}

export function publicDisplayStatus(enabled: boolean, lastStatus: TargetStatus): DisplayStatus {
  return enabled ? lastStatus : 'paused';
}
