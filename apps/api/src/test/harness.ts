import { createPool, migrate, type DbPool } from '@beacon-watch/db';
import { buildApp } from '../app.js';
import { loadConfig, type ApiConfig } from '../config.js';
import type { LookupFn } from '../lookup.js';

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

export function testConfig(overrides: Record<string, string> = {}): ApiConfig {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: requireDatabaseUrl() || 'postgres://beacon:beacon@localhost:5432/beacon',
    SESSION_SECRET: 'replace-me-with-at-least-32-random-characters',
    SSRF_PROTECTION: 'true',
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

export function parseCookies(setCookie: string | string[] | undefined): {
  header: string;
  csrf: string;
  session: string;
} {
  const parts = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  const pairs: string[] = [];
  const map: Record<string, string> = {};
  for (const part of parts) {
    const pair = part.split(';', 1)[0] ?? '';
    pairs.push(pair);
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  return {
    header: pairs.join('; '),
    csrf: map['beacon_csrf'] ?? '',
    session: map['beacon_session'] ?? '',
  };
}

export async function buildTestApp(opts: { lookup?: LookupFn; config?: ApiConfig; pool: DbPool; now?: () => Date }) {
  const config = opts.config ?? testConfig();
  const lookup = opts.lookup ?? (async () => ['93.184.216.34']);
  return buildApp(config, { pool: opts.pool, lookup, ...(opts.now ? { now: opts.now } : {}) });
}
