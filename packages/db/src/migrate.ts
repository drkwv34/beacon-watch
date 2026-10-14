import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DbPool } from './client.js';
import { MIGRATIONS_DIR } from './paths.js';

const FILENAME_RE = /^\d{4}_.+\.sql$/;

export function isMigrationFilename(name: string): boolean {
  return FILENAME_RE.test(name);
}

export async function listMigrationFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir);
  return names.filter((name) => isMigrationFilename(name)).sort();
}

/**
 * Apply pending `NNNN_*.sql` files in lexical order. Each file runs in one
 * transaction; the runner records applied names in `schema_migrations`.
 */
export async function migrate(pool: DbPool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const client = await pool.connect();
  const appliedNow: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const already = new Set(rows.map((row) => row.filename));
    const files = await listMigrationFiles(dir);

    for (const filename of files) {
      if (already.has(filename)) continue;
      const sql = await readFile(path.join(dir, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        appliedNow.push(filename);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // surface the migration error
        }
        throw err;
      }
    }
    return appliedNow;
  } finally {
    client.release();
  }
}
