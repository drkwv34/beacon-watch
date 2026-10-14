import { afterAll, describe, expect, it } from 'vitest';
import type { DbPool } from '@beacon-watch/db';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig({
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  SESSION_SECRET: 'replace-me-with-at-least-32-random-characters',
});

const pool = {
  query: async () => {
    throw new Error('pool should not be queried for missing cookies');
  },
} as unknown as DbPool;

describe('auth gate', () => {
  const setup = buildApp(config, { pool, lookup: async () => ['1.1.1.1'] });
  afterAll(async () => {
    await (await setup).close();
  });

  it('returns 401 for GET /api/v1/__probe without a session', async () => {
    const app = await setup;
    const res = await app.inject({ method: 'GET', url: '/api/v1/__probe' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });
});
