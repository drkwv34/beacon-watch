import { asUserId, type UserId } from '@beacon-watch/domain';
import type { Queryable } from '../client.js';
import { conflictIfUnique } from '../errors.js';

export interface UserRow {
  id: UserId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function mapUser(row: UserRecord): UserRow {
  return {
    id: asUserId(row.id),
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function insertUser(db: Queryable, input: { email: string; passwordHash: string }): Promise<UserRow> {
  try {
    const { rows } = await db.query<UserRecord>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, password_hash, created_at`,
      [input.email, input.passwordHash],
    );
    return mapUser(rows[0]!);
  } catch (err) {
    conflictIfUnique(err, 'users_email_lower_key', 'Email already registered', 'email');
  }
}

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRecord>(
    `SELECT id, email, password_hash, created_at FROM users WHERE email_lower = lower($1)`,
    [email],
  );
  const row = rows[0];
  return row ? mapUser(row) : undefined;
}

export async function findUserById(db: Queryable, id: UserId): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRecord>(`SELECT id, email, password_hash, created_at FROM users WHERE id = $1`, [
    id,
  ]);
  const row = rows[0];
  return row ? mapUser(row) : undefined;
}

export async function updateUserPasswordHash(
  db: Queryable,
  id: UserId,
  passwordHash: string,
): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRecord>(
    `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id, email, password_hash, created_at`,
    [id, passwordHash],
  );
  const row = rows[0];
  return row ? mapUser(row) : undefined;
}
