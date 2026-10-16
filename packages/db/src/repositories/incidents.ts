import {
  asCheckId,
  asIncidentId,
  asTargetId,
  type CheckId,
  type IncidentId,
  type IncidentStatus,
  type TargetId,
} from '@beacon-watch/domain';
import type { Queryable } from '../client.js';

export const OPEN_INCIDENT_INDEX = 'incidents_one_open_per_target_idx';

export interface IncidentRow {
  id: IncidentId;
  targetId: TargetId;
  status: IncidentStatus;
  openedAt: Date;
  resolvedAt: Date | null;
  triggerCheckId: CheckId;
  resolveCheckId: CheckId | null;
}

interface IncidentRecord {
  id: string;
  target_id: string;
  status: IncidentStatus;
  opened_at: Date;
  resolved_at: Date | null;
  trigger_check_id: string;
  resolve_check_id: string | null;
}

export function mapIncident(row: IncidentRecord): IncidentRow {
  return {
    id: asIncidentId(row.id),
    targetId: asTargetId(row.target_id),
    status: row.status,
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at,
    triggerCheckId: asCheckId(row.trigger_check_id),
    resolveCheckId: row.resolve_check_id ? asCheckId(row.resolve_check_id) : null,
  };
}

export function toPublicIncident(row: IncidentRow, now: Date): Record<string, unknown> {
  const end = row.resolvedAt ?? now;
  const durationSeconds = Math.max(0, Math.floor((end.getTime() - row.openedAt.getTime()) / 1000));
  return {
    id: row.id,
    status: row.status,
    opened_at: row.openedAt.toISOString(),
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    trigger_check_id: row.triggerCheckId,
    duration_seconds: durationSeconds,
  };
}

export async function findOpenIncident(db: Queryable, targetId: TargetId): Promise<IncidentRow | undefined> {
  const { rows } = await db.query<IncidentRecord>(`SELECT * FROM incidents WHERE target_id = $1 AND status = 'open'`, [
    targetId,
  ]);
  const row = rows[0];
  return row ? mapIncident(row) : undefined;
}

export async function listIncidentsForTarget(db: Queryable, targetId: TargetId): Promise<IncidentRow[]> {
  const { rows } = await db.query<IncidentRecord>(
    `SELECT * FROM incidents WHERE target_id = $1 ORDER BY opened_at DESC, id DESC`,
    [targetId],
  );
  return rows.map(mapIncident);
}

export async function insertOpenIncident(
  db: Queryable,
  input: { targetId: TargetId; openedAt: Date; triggerCheckId: CheckId },
): Promise<IncidentRow | undefined> {
  const { rows } = await db.query<IncidentRecord>(
    `INSERT INTO incidents (target_id, status, opened_at, trigger_check_id)
     VALUES ($1, 'open', $2, $3)
     ON CONFLICT (target_id) WHERE (status = 'open') DO NOTHING
     RETURNING *`,
    [input.targetId, input.openedAt, input.triggerCheckId],
  );
  if (rows[0]) return mapIncident(rows[0]);
  return findOpenIncident(db, input.targetId);
}

export async function resolveIncident(
  db: Queryable,
  id: IncidentId,
  patch: { resolvedAt: Date; resolveCheckId: CheckId },
): Promise<IncidentRow | undefined> {
  const { rows } = await db.query<IncidentRecord>(
    `UPDATE incidents SET status = 'resolved', resolved_at = $2, resolve_check_id = $3
     WHERE id = $1 AND status = 'open'
     RETURNING *`,
    [id, patch.resolvedAt, patch.resolveCheckId],
  );
  const row = rows[0];
  return row ? mapIncident(row) : undefined;
}
