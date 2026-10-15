import {
  asCheckId,
  asTargetId,
  truncateErrorMessage,
  type CheckId,
  type ProbeErrorCode,
  type TargetId,
} from '@beacon-watch/domain';
import type { Queryable } from '../client.js';

export interface CheckRow {
  id: CheckId;
  targetId: TargetId;
  checkedAt: Date;
  success: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  errorCode: ProbeErrorCode | null;
  errorMessage: string | null;
}

interface CheckRecord {
  id: string;
  target_id: string;
  checked_at: Date;
  success: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_code: ProbeErrorCode | null;
  error_message: string | null;
}

export function mapCheck(row: CheckRecord): CheckRow {
  return {
    id: asCheckId(row.id),
    targetId: asTargetId(row.target_id),
    checkedAt: row.checked_at,
    success: row.success,
    statusCode: row.status_code,
    latencyMs: row.latency_ms,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

export async function insertCheck(
  db: Queryable,
  input: {
    targetId: TargetId;
    checkedAt: Date;
    success: boolean;
    statusCode: number | null;
    latencyMs: number | null;
    errorCode: ProbeErrorCode | null;
    errorMessage: string | null;
  },
): Promise<CheckRow> {
  const { rows } = await db.query<CheckRecord>(
    `INSERT INTO checks (
       target_id, checked_at, success, status_code, latency_ms, error_code, error_message
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.targetId,
      input.checkedAt,
      input.success,
      input.statusCode,
      input.latencyMs,
      input.errorCode,
      truncateErrorMessage(input.errorMessage),
    ],
  );
  return mapCheck(rows[0]!);
}

export async function listChecksForTarget(db: Queryable, targetId: TargetId): Promise<CheckRow[]> {
  const { rows } = await db.query<CheckRecord>(
    `SELECT * FROM checks WHERE target_id = $1 ORDER BY checked_at DESC, id DESC`,
    [targetId],
  );
  return rows.map(mapCheck);
}

export async function countChecksForTarget(db: Queryable, targetId: TargetId): Promise<number> {
  const { rows } = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM checks WHERE target_id = $1`, [
    targetId,
  ]);
  return Number(rows[0]?.n ?? 0);
}
