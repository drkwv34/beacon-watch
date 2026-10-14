import { createRequire } from 'node:module';
import type { Client as PgClientType, QueryResult, QueryResultRow } from 'pg';

const require = createRequire(import.meta.url);
const PgClient = require('pg/lib/client') as typeof PgClientType;

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export interface DbClient extends Queryable {
  release(): void;
}

export interface DbPool extends Queryable {
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}

interface PoolOptions {
  connectionString: string;
  connectionTimeoutMillis?: number;
  max?: number;
  options?: string;
}

class PooledClient implements DbClient {
  constructor(
    private readonly client: InstanceType<typeof PgClient>,
    private readonly onRelease: (client: InstanceType<typeof PgClient>) => void,
  ) {}

  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> {
    return this.client.query(text, values) as Promise<QueryResult<R>>;
  }

  release(): void {
    this.onRelease(this.client);
  }
}

/** Pool over `pg.Client` so we never load `pg-pool` (broken under Vitest ESM interop). */
export class Pool implements DbPool {
  private readonly idle: Array<InstanceType<typeof PgClient>> = [];
  private readonly busy = new Set<InstanceType<typeof PgClient>>();
  private readonly waiters: Array<(client: InstanceType<typeof PgClient>) => void> = [];
  private ended = false;

  constructor(private readonly opts: PoolOptions) {}

  async query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> {
    const client = await this.connect();
    try {
      return await client.query<R>(text, values);
    } finally {
      client.release();
    }
  }

  async connect(): Promise<DbClient> {
    if (this.ended) throw new Error('pool is closed');
    const raw = await this.acquire();
    return new PooledClient(raw, (client) => this.releaseRaw(client));
  }

  async end(): Promise<void> {
    this.ended = true;
    const all = [...this.idle, ...this.busy];
    this.idle.length = 0;
    this.busy.clear();
    await Promise.all(
      all.map(async (client) => {
        try {
          await client.end();
        } catch {
          // ignore
        }
      }),
    );
  }

  private async acquire(): Promise<InstanceType<typeof PgClient>> {
    const idle = this.idle.pop();
    if (idle) {
      this.busy.add(idle);
      return idle;
    }
    const max = this.opts.max ?? 10;
    if (this.busy.size < max) {
      const client = new PgClient({
        connectionString: this.opts.connectionString,
        connectionTimeoutMillis: this.opts.connectionTimeoutMillis,
        options: this.opts.options,
      });
      await client.connect();
      this.busy.add(client);
      return client;
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private releaseRaw(client: InstanceType<typeof PgClient>): void {
    this.busy.delete(client);
    const waiter = this.waiters.shift();
    if (waiter) {
      this.busy.add(client);
      waiter(client);
      return;
    }
    this.idle.push(client);
  }
}

export function createPool(databaseUrl: string): DbPool {
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    max: 10,
    options: '-c statement_timeout=5000',
  });
}
