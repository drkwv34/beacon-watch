import 'server-only';
import { cache } from 'react';
import { createPool, loadPublicStatusBySlug, type DbPool } from '@beacon-watch/db/public-status';
import type { PublicStatusPayload } from '@beacon-watch/domain';
import { loadStatusDbConfig } from '../config';

let pool: DbPool | undefined;

function getPool(): DbPool {
  if (!pool) {
    pool = createPool(loadStatusDbConfig().DATABASE_URL);
  }
  return pool;
}

export type PublicStatusRead =
  { ok: true; payload: PublicStatusPayload } | { ok: false; reason: 'not_found' | 'unavailable' };

/** One Postgres read per request; layout and page share the result. No client bypass of is_public. */
export const readPublicStatus = cache(async (slug: string): Promise<PublicStatusRead> => {
  try {
    const payload = await loadPublicStatusBySlug(getPool(), slug, new Date());
    if (!payload) return { ok: false, reason: 'not_found' };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
});
