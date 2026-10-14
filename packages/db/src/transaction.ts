import type { DbClient, DbPool } from './client.js';

/** One use case = at most one transaction, opened in the service layer. */
export async function withTransaction<T>(pool: DbPool, fn: (tx: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is the one callers must see.
    }
    throw err;
  } finally {
    client.release();
  }
}
