import {
  asTargetId,
  asUserId,
  computeNextCheckAt,
  type HttpMethod,
  type TargetHeaders,
  type TargetId,
  type TargetStatus,
  type UserId,
} from '@beacon-watch/domain';
import type { Queryable } from '../client.js';
import { conflictIfUnique } from '../errors.js';

export interface TargetRow {
  id: TargetId;
  userId: UserId;
  name: string;
  url: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  headers: TargetHeaders | null;
  body: string | null;
  graceThreshold: number;
  recoveryThreshold: number;
  enabled: boolean;
  isPublic: boolean;
  publicSlug: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastStatus: TargetStatus;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TargetRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: HttpMethod;
  interval_seconds: number;
  timeout_ms: number;
  expected_status: number;
  headers: TargetHeaders | null;
  body: string | null;
  grace_threshold: number;
  recovery_threshold: number;
  enabled: boolean;
  is_public: boolean;
  public_slug: string | null;
  consecutive_failures: number;
  consecutive_successes: number;
  last_status: TargetStatus;
  last_checked_at: Date | null;
  next_check_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function mapTarget(row: TargetRecord): TargetRow {
  return {
    id: asTargetId(row.id),
    userId: asUserId(row.user_id),
    name: row.name,
    url: row.url,
    method: row.method,
    intervalSeconds: row.interval_seconds,
    timeoutMs: row.timeout_ms,
    expectedStatus: row.expected_status,
    headers: row.headers,
    body: row.body,
    graceThreshold: row.grace_threshold,
    recoveryThreshold: row.recovery_threshold,
    enabled: row.enabled,
    isPublic: row.is_public,
    publicSlug: row.public_slug,
    consecutiveFailures: row.consecutive_failures,
    consecutiveSuccesses: row.consecutive_successes,
    lastStatus: row.last_status,
    lastCheckedAt: row.last_checked_at,
    nextCheckAt: row.next_check_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicTarget(row: TargetRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: row.method,
    interval_seconds: row.intervalSeconds,
    timeout_ms: row.timeoutMs,
    expected_status: row.expectedStatus,
    headers: row.headers,
    body: row.body,
    grace_threshold: row.graceThreshold,
    recovery_threshold: row.recoveryThreshold,
    enabled: row.enabled,
    is_public: row.isPublic,
    public_slug: row.publicSlug,
    last_status: row.enabled ? row.lastStatus : 'paused',
    last_checked_at: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function countTargetsForUser(db: Queryable, userId: UserId): Promise<number> {
  const { rows } = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM targets WHERE user_id = $1`, [
    userId,
  ]);
  return Number(rows[0]?.n ?? 0);
}

export async function insertTarget(
  db: Queryable,
  input: {
    userId: UserId;
    name: string;
    url: string;
    method: HttpMethod;
    intervalSeconds: number;
    timeoutMs: number;
    expectedStatus: number;
    headers: TargetHeaders | null;
    body: string | null;
    graceThreshold: number;
    recoveryThreshold: number;
    enabled: boolean;
    isPublic: boolean;
    publicSlug: string | null;
    now: Date;
  },
): Promise<TargetRow> {
  try {
    const { rows } = await db.query<TargetRecord>(
      `INSERT INTO targets (
         user_id, name, url, method, interval_seconds, timeout_ms, expected_status,
         headers, body, grace_threshold, recovery_threshold, enabled, is_public, public_slug,
         next_check_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14,
         $15, $15, $15
       )
       RETURNING *`,
      [
        input.userId,
        input.name,
        input.url,
        input.method,
        input.intervalSeconds,
        input.timeoutMs,
        input.expectedStatus,
        input.headers,
        input.body,
        input.graceThreshold,
        input.recoveryThreshold,
        input.enabled,
        input.isPublic,
        input.publicSlug,
        input.now,
      ],
    );
    return mapTarget(rows[0]!);
  } catch (err) {
    conflictIfUnique(err, 'targets_public_slug_idx', 'Slug already taken', 'public_slug');
  }
}

export async function findTargetById(db: Queryable, id: TargetId): Promise<TargetRow | undefined> {
  const { rows } = await db.query<TargetRecord>(`SELECT * FROM targets WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapTarget(row) : undefined;
}

export async function findPublicTargetBySlug(db: Queryable, slug: string): Promise<TargetRow | undefined> {
  const { rows } = await db.query<TargetRecord>(`SELECT * FROM targets WHERE public_slug = $1 AND is_public = true`, [
    slug,
  ]);
  const row = rows[0];
  return row ? mapTarget(row) : undefined;
}

export async function listTargetsForUser(db: Queryable, userId: UserId, opts: { limit: number }): Promise<TargetRow[]> {
  const { rows } = await db.query<TargetRecord>(
    `SELECT * FROM targets WHERE user_id = $1 ORDER BY created_at ASC, id ASC LIMIT $2`,
    [userId, opts.limit],
  );
  return rows.map(mapTarget);
}

export async function updateTarget(
  db: Queryable,
  id: TargetId,
  patch: {
    name: string;
    url: string;
    method: HttpMethod;
    intervalSeconds: number;
    timeoutMs: number;
    expectedStatus: number;
    headers: TargetHeaders | null;
    body: string | null;
    graceThreshold: number;
    recoveryThreshold: number;
    enabled: boolean;
    isPublic: boolean;
    publicSlug: string | null;
    now: Date;
  },
): Promise<TargetRow> {
  try {
    const { rows } = await db.query<TargetRecord>(
      `UPDATE targets SET
         name = $2,
         url = $3,
         method = $4,
         interval_seconds = $5,
         timeout_ms = $6,
         expected_status = $7,
         headers = $8,
         body = $9,
         grace_threshold = $10,
         recovery_threshold = $11,
         enabled = $12,
         is_public = $13,
         public_slug = $14,
         updated_at = $15
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.name,
        patch.url,
        patch.method,
        patch.intervalSeconds,
        patch.timeoutMs,
        patch.expectedStatus,
        patch.headers,
        patch.body,
        patch.graceThreshold,
        patch.recoveryThreshold,
        patch.enabled,
        patch.isPublic,
        patch.publicSlug,
        patch.now,
      ],
    );
    return mapTarget(rows[0]!);
  } catch (err) {
    conflictIfUnique(err, 'targets_public_slug_idx', 'Slug already taken', 'public_slug');
  }
}

export async function deleteTarget(db: Queryable, id: TargetId): Promise<boolean> {
  const result = await db.query(`DELETE FROM targets WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function claimDueTargets(
  db: Queryable,
  input: { now: Date; limit: number; random: () => number },
): Promise<TargetRow[]> {
  if (input.limit <= 0) return [];
  const { rows } = await db.query<TargetRecord>(
    `SELECT * FROM targets
     WHERE enabled AND next_check_at <= $1
     ORDER BY next_check_at ASC, id ASC
     FOR UPDATE SKIP LOCKED
     LIMIT $2`,
    [input.now, input.limit],
  );
  const claimed: TargetRow[] = [];
  for (const row of rows) {
    const nextCheckAt = computeNextCheckAt(input.now, row.interval_seconds, input.random);
    const updated = await db.query<TargetRecord>(
      `UPDATE targets SET next_check_at = $2, updated_at = $3 WHERE id = $1 RETURNING *`,
      [row.id, nextCheckAt, input.now],
    );
    claimed.push(mapTarget(updated.rows[0]!));
  }
  return claimed;
}

export async function lockTargetForUpdate(db: Queryable, id: TargetId): Promise<TargetRow | undefined> {
  const { rows } = await db.query<TargetRecord>(`SELECT * FROM targets WHERE id = $1 FOR UPDATE`, [id]);
  const row = rows[0];
  return row ? mapTarget(row) : undefined;
}

export async function updateTargetAfterCheck(
  db: Queryable,
  id: TargetId,
  patch: {
    lastCheckedAt: Date;
    lastStatus: TargetStatus;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    now: Date;
  },
): Promise<TargetRow | undefined> {
  const { rows } = await db.query<TargetRecord>(
    `UPDATE targets SET
       last_checked_at = $2,
       last_status = $3,
       consecutive_failures = $4,
       consecutive_successes = $5,
       updated_at = $6
     WHERE id = $1
     RETURNING *`,
    [id, patch.lastCheckedAt, patch.lastStatus, patch.consecutiveFailures, patch.consecutiveSuccesses, patch.now],
  );
  const row = rows[0];
  return row ? mapTarget(row) : undefined;
}
