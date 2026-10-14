import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '@beacon-watch/db';
import { BODY_MAX_BYTES } from '@beacon-watch/domain';
import { buildTestApp, openTestPool, parseCookies, requireDatabaseUrl, resetDb, testConfig } from './test/harness.js';

const skip = !requireDatabaseUrl();

async function register(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  email: string,
): Promise<{ header: string; csrf: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password12' },
  });
  expect(res.statusCode).toBe(201);
  return parseCookies(res.headers['set-cookie']);
}

describe.skipIf(skip)('targets integration', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    pool = await openTestPool();
    app = await buildTestApp({
      pool,
      lookup: async (hostname) => {
        if (hostname === 'private.example.test') return ['10.1.2.3'];
        if (hostname === 'localhost') return ['127.0.0.1'];
        return ['93.184.216.34'];
      },
    });
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('creates, lists, pauses, updates, and hard-deletes a target', async () => {
    const auth = await register(app, 'owner@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Homepage', url: 'https://example.com/health' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(created.json()).toMatchObject({
      name: 'Homepage',
      method: 'GET',
      interval_seconds: 60,
      timeout_ms: 5000,
      expected_status: 200,
      last_status: 'unknown',
    });

    const listed = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: { cookie: auth.header } });
    expect(listed.json().items).toHaveLength(1);

    const paused = await app.inject({
      method: 'PATCH',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { enabled: false },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({ enabled: false, last_status: 'paused' });

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
    });
    expect(deleted.statusCode).toBe(204);
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: auth.header },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('returns an empty items array for a new user', async () => {
    const auth = await register(app, 'empty@example.com');
    const listed = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: { cookie: auth.header } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ items: [], next_cursor: null });
  });

  it('rejects each SRS bound with 400', async () => {
    const auth = await register(app, 'bounds@example.com');
    const headers = { cookie: auth.header, 'x-csrf-token': auth.csrf };
    const cases: Array<{ payload: Record<string, unknown>; field: string }> = [
      { payload: { name: 'x', url: 'https://example.com', interval_seconds: 29 }, field: 'interval_seconds' },
      { payload: { name: 'x', url: 'https://example.com', interval_seconds: 3601 }, field: 'interval_seconds' },
      { payload: { name: 'x', url: 'https://example.com', timeout_ms: 499 }, field: 'timeout_ms' },
      { payload: { name: 'x', url: 'https://example.com', timeout_ms: 10001 }, field: 'timeout_ms' },
      { payload: { name: 'x', url: 'https://example.com', method: 'PUT' }, field: 'method' },
      { payload: { name: 'x', url: 'ftp://example.com' }, field: 'url' },
      { payload: { name: 'x', url: 'https://example.com', body: '{}' }, field: 'body' },
      {
        payload: { name: 'x', url: 'https://example.com', method: 'POST', body: 'y'.repeat(BODY_MAX_BYTES + 1) },
        field: 'body',
      },
    ];
    for (const testCase of cases) {
      const res = await app.inject({ method: 'POST', url: '/api/v1/targets', headers, payload: testCase.payload });
      expect(res.statusCode, JSON.stringify(testCase)).toBe(400);
      expect(res.json().error.details.fields, JSON.stringify(testCase)).toHaveProperty(testCase.field);
    }
  });

  it('rejects SSRF loopback, RFC1918, link-local, and DNS-to-private', async () => {
    const auth = await register(app, 'ssrf@example.com');
    const headers = { cookie: auth.header, 'x-csrf-token': auth.csrf };
    for (const url of [
      'http://127.0.0.1/',
      'http://10.0.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/',
      'http://private.example.test/',
      'http://localhost/',
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/targets',
        headers,
        payload: { name: 'bad', url },
      });
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.details.fields, url).toHaveProperty('url');
    }
  });

  it('returns 409 when public_slug is taken', async () => {
    const auth = await register(app, 'slug@example.com');
    const headers = { cookie: auth.header, 'x-csrf-token': auth.csrf };
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers,
      payload: { name: 'A', url: 'https://example.com/a', public_slug: 'shared' },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers,
      payload: { name: 'B', url: 'https://example.com/b', public_slug: 'shared' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'CONFLICT', details: { field: 'public_slug' } } });
  });

  it('returns 403 for another user and 404 for an unknown id', async () => {
    const owner = await register(app, 'a@example.com');
    const other = await register(app, 'b@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: owner.header, 'x-csrf-token': owner.csrf },
      payload: { name: 'A', url: 'https://example.com' },
    });
    const id = created.json().id as string;
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: other.header },
    });
    expect(forbidden.statusCode).toBe(403);
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${randomUUID()}`,
      headers: { cookie: owner.header },
    });
    expect(missing.statusCode).toBe(404);
    const listed = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: { cookie: other.header } });
    expect(listed.json().items).toEqual([]);
  });
});

describe.skipIf(skip)('targets allowlist', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    pool = await openTestPool();
    app = await buildTestApp({
      pool,
      config: testConfig({ SSRF_ALLOWLIST: 'mock-target' }),
      lookup: async () => ['172.18.0.2'],
    });
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('allows mock-target when listed', async () => {
    const auth = await register(app, 'demo@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Mock', url: 'http://mock-target:8080/health' },
    });
    expect(created.statusCode).toBe(201);
  });
});
