import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import { migrate } from './migrate.js';
import type { DbPool } from './client.js';

class MemoryClient {
  readonly tables = new Set<string>();
  readonly applied = new Set<string>();
  inTx = false;

  async query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> {
    const sql = text.trim();
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      this.tables.add('schema_migrations');
      return emptyResult();
    }
    if (sql.startsWith('SELECT filename FROM schema_migrations')) {
      return {
        rows: [...this.applied].map((filename) => ({ filename })) as unknown as R[],
        command: 'SELECT',
        rowCount: this.applied.size,
        oid: 0,
        fields: [],
      };
    }
    if (sql === 'BEGIN') {
      this.inTx = true;
      return emptyResult();
    }
    if (sql === 'COMMIT') {
      this.inTx = false;
      return emptyResult();
    }
    if (sql === 'ROLLBACK') {
      this.inTx = false;
      return emptyResult();
    }
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.applied.add(String(values?.[0]));
      return emptyResult();
    }
    if (sql.startsWith('CREATE TABLE')) {
      const match = /CREATE TABLE (\w+)/.exec(sql);
      if (match) this.tables.add(match[1]!);
      return emptyResult();
    }
    return emptyResult();
  }

  release(): void {
    // no-op
  }
}

function emptyResult<R extends QueryResultRow = QueryResultRow>(): QueryResult<R> {
  return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
}

describe('migrate apply', () => {
  it('applies two fixture files then no-ops on re-run', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bw-mig-apply-'));
    await writeFile(path.join(dir, '0001_a.sql'), 'CREATE TABLE alpha (id int);');
    await writeFile(path.join(dir, '0002_b.sql'), 'CREATE TABLE beta (id int);');

    const client = new MemoryClient();
    const pool = {
      connect: async () => client,
    } as unknown as DbPool;

    await expect(migrate(pool, dir)).resolves.toEqual(['0001_a.sql', '0002_b.sql']);
    expect(client.tables.has('alpha')).toBe(true);
    expect(client.tables.has('beta')).toBe(true);
    await expect(migrate(pool, dir)).resolves.toEqual([]);
    expect(client.applied.size).toBe(2);
  });
});
