import type { DisplayStatus, TargetStatus } from '../target-status.js';
import { CACHE_VALUE_VERSION } from './keys.js';

export interface PublicOpenIncident {
  opened_at: string;
  duration_seconds: number;
}

export interface PublicStatusPayload {
  name: string;
  status: DisplayStatus;
  last_checked_at: string | null;
  latency_ms: number | null;
  uptime_24h: number | null;
  open_incident: PublicOpenIncident | null;
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
