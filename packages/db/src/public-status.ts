import { publicDisplayStatus, uptime24h, type PublicStatusPayload } from '@beacon-watch/domain';
import type { Queryable } from './client.js';
import {
  countChecksForTarget,
  countChecksSince,
  countSuccessfulChecksForTarget,
  findLatestCheck,
} from './repositories/checks.js';
import { findOpenIncident, listIncidentsForTarget, toPublicRecentIncident } from './repositories/incidents.js';
import { findPublicTargetBySlug } from './repositories/targets.js';

export { createPool, type DbPool } from './client.js';

/** Public DTO only: never ids, URLs, owner, headers, or body. `findPublicTargetBySlug` enforces is_public. */
export async function loadPublicStatusBySlug(
  db: Queryable,
  slug: string,
  now: Date,
): Promise<PublicStatusPayload | undefined> {
  const target = await findPublicTargetBySlug(db, slug);
  if (!target) return undefined;
  const latest = await findLatestCheck(db, target.id);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const counts = await countChecksSince(db, target.id, since);
  const open = await findOpenIncident(db, target.id);
  const durationSeconds = open ? Math.max(0, Math.floor((now.getTime() - open.openedAt.getTime()) / 1000)) : 0;
  const checkCount = await countChecksForTarget(db, target.id);
  const successCount = await countSuccessfulChecksForTarget(db, target.id);
  const incidents = await listIncidentsForTarget(db, target.id);
  const payload: PublicStatusPayload = {
    name: target.name,
    status: publicDisplayStatus(target.enabled, target.lastStatus),
    last_checked_at: target.lastCheckedAt ? target.lastCheckedAt.toISOString() : null,
    latency_ms: latest?.latencyMs ?? null,
    uptime_24h: uptime24h(counts.successes, counts.total),
    open_incident: open ? { opened_at: open.openedAt.toISOString(), duration_seconds: durationSeconds } : null,
    check_count: checkCount,
    ever_succeeded: successCount > 0,
    recent_incidents: incidents.slice(0, 10).map((row) => toPublicRecentIncident(row, now)),
  };
  return payload;
}
