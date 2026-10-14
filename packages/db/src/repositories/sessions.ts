import { asUserId, type UserId } from '@beacon-watch/domain';
import type { Queryable } from '../client.js';

export interface SessionRow {
  id: string;
  userId: UserId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

function mapSession(row: SessionRecord): SessionRow {
  return {
    id: row.id,
    userId: asUserId(row.user_id),
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function insertSession(
  db: Queryable,
  input: { userId: UserId; tokenHash: string; expiresAt: Date },
): Promise<SessionRow> {
  const { rows } = await db.query<SessionRecord>(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, token_hash, expires_at, created_at`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
  return mapSession(rows[0]!);
}

export async function findSessionByTokenHash(db: Queryable, tokenHash: string): Promise<SessionRow | undefined> {
  const { rows } = await db.query<SessionRecord>(
    `SELECT id, user_id, token_hash, expires_at, created_at
     FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  return row ? mapSession(row) : undefined;
}

export async function deleteSessionByTokenHash(db: Queryable, tokenHash: string): Promise<boolean> {
  const result = await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
  return (result.rowCount ?? 0) > 0;
}

export async function touchSessionExpiry(db: Queryable, id: string, expiresAt: Date): Promise<void> {
  await db.query(`UPDATE sessions SET expires_at = $2 WHERE id = $1`, [id, expiresAt]);
}
