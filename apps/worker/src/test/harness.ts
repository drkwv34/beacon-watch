import { createPool, insertTarget, insertUser, migrate, type DbPool, type TargetRow } from '@beacon-watch/db';
import { pino } from 'pino';
import { listenMockTarget } from '../../../../mock-target/src/server.js';
import { loadConfig, type WorkerConfig } from '../config.js';
import type { SchedulerDeps } from '../modules/scheduling/run-check.js';
import { HostSemaphore, Semaphore } from '../pool/semaphore.js';
import type { ProbeClient } from '../probe/client.js';

export { listenMockTarget };

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

export function testConfig(overrides: Record<string, string> = {}): WorkerConfig {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: requireDatabaseUrl() || 'postgres://beacon:beacon@localhost:5432/beacon',
    SSRF_PROTECTION: 'false',
    PROBE_MAX_CONCURRENCY: '4',
    PROBE_MAX_PER_HOST: '2',
    ...overrides,
  });
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

export async function seedDueTarget(
  pool: DbPool,
  now: Date,
  overrides: { url?: string; timeoutMs?: number; expectedStatus?: number; intervalSeconds?: number } = {},
): Promise<TargetRow> {
  const user = await insertUser(pool, {
    email: `owner-${crypto.randomUUID()}@example.com`,
    passwordHash: 'x'.repeat(32),
  });
  return insertTarget(pool, {
    userId: user.id,
    name: 'Monitor',
    url: overrides.url ?? 'http://127.0.0.1:8080/health',
    method: 'GET',
    intervalSeconds: overrides.intervalSeconds ?? 60,
    timeoutMs: overrides.timeoutMs ?? 2000,
    expectedStatus: overrides.expectedStatus ?? 200,
    headers: null,
    body: null,
    graceThreshold: 2,
    recoveryThreshold: 2,
    enabled: true,
    isPublic: false,
    publicSlug: null,
    now,
  });
}

export function schedulerDeps(pool: DbPool, probe: ProbeClient, overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  return {
    pool,
    probe,
    log: pino({ level: 'silent' }),
    global: new Semaphore(4),
    perHost: new HostSemaphore(2),
    now: () => new Date(),
    random: () => 0,
    sleep: async () => undefined,
    pollMs: 20,
    ...overrides,
  };
}
