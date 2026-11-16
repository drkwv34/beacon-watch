import { asUserId, type UserId } from '@beacon-watch/domain';
import type { Queryable } from '../client.js';

export interface ApiTokenRow {
  id: string;
  userId: UserId;
  tokenHash: string;
  prefix: string;
  label: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

interface ApiTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  prefix: string;
  label: string;
  created_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
  last_used_at: Date | null;
}

function mapApiToken(row: ApiTokenRecord): ApiTokenRow {
  return {
    id: row.id,
    userId: asUserId(row.user_id),
    tokenHash: row.token_hash,
    prefix: row.prefix,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export function toPublicApiToken(row: ApiTokenRow): Record<string, unknown> {
  return {
    id: row.id,
    label: row.label,
    prefix: row.prefix,
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : null,
    last_used_at: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function insertApiToken(
  db: Queryable,
  input: {
    userId: UserId;
    tokenHash: string;
    prefix: string;
    label: string;
    expiresAt: Date | null;
  },
): Promise<ApiTokenRow> {
  const { rows } = await db.query<ApiTokenRecord>(
    `INSERT INTO api_tokens (user_id, token_hash, prefix, label, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, token_hash, prefix, label, created_at, expires_at, revoked_at, last_used_at`,
    [input.userId, input.tokenHash, input.prefix, input.label, input.expiresAt],
  );
  return mapApiToken(rows[0]!);
}

export async function findApiTokenByHash(db: Queryable, tokenHash: string): Promise<ApiTokenRow | undefined> {
  const { rows } = await db.query<ApiTokenRecord>(
    `SELECT id, user_id, token_hash, prefix, label, created_at, expires_at, revoked_at, last_used_at
     FROM api_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  return row ? mapApiToken(row) : undefined;
}

export async function listApiTokensForUser(db: Queryable, userId: UserId): Promise<ApiTokenRow[]> {
  const { rows } = await db.query<ApiTokenRecord>(
    `SELECT id, user_id, token_hash, prefix, label, created_at, expires_at, revoked_at, last_used_at
     FROM api_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapApiToken);
}

export async function revokeApiTokenForUser(
  db: Queryable,
  input: { id: string; userId: UserId; now: Date },
): Promise<ApiTokenRow | undefined> {
  const { rows } = await db.query<ApiTokenRecord>(
    `UPDATE api_tokens
     SET revoked_at = $3
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id, user_id, token_hash, prefix, label, created_at, expires_at, revoked_at, last_used_at`,
    [input.id, input.userId, input.now],
  );
  const row = rows[0];
  return row ? mapApiToken(row) : undefined;
}

export async function touchApiTokenLastUsed(db: Queryable, id: string, now: Date): Promise<void> {
  await db.query(`UPDATE api_tokens SET last_used_at = $2 WHERE id = $1 AND revoked_at IS NULL`, [id, now]);
}
