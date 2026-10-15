import { createPool, migrate, type DbPool } from '../index.js';

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.CI) {
      throw new Error('DATABASE_URL is required in CI for integration tests');
    }
    return '';
  }
  return url;
}

export async function openTestPool(): Promise<DbPool> {
  const pool = createPool(requireDatabaseUrl());
  await pool.query("SET statement_timeout = '5000'");
  await migrate(pool);
  return pool;
}

export async function resetDb(pool: DbPool): Promise<void> {
  await pool.query('TRUNCATE users CASCADE');
}
