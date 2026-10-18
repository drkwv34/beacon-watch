import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asTargetId } from '@beacon-watch/domain';
import { findTargetById, insertCheck, type DbPool } from '@beacon-watch/db';
import { buildTestApp, openTestPool, parseCookies, requireDatabaseUrl, resetDb } from './test/harness.js';

const skip = !requireDatabaseUrl();
const NOW = new Date('2026-10-17T12:00:00.000Z');

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

describe.skipIf(skip)('owner checks and check-now', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    pool = await openTestPool();
    app = await buildTestApp({
      pool,
      now: () => NOW,
      lookup: async () => ['93.184.216.34'],
    });
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function createTarget(auth: { header: string; csrf: string }): Promise<string> {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Homepage', url: 'https://example.com/health' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().latency_ms).toBeNull();
    return created.json().id as string;
  }

  it('lists recent checks newest first and includes latency on the target', async () => {
    const auth = await register(app, 'owner@example.com');
    const id = await createTarget(auth);
    const older = new Date('2026-10-17T11:00:00.000Z');
    const newer = new Date('2026-10-17T11:05:00.000Z');
    await insertCheck(pool, {
      targetId: asTargetId(id),
      checkedAt: older,
      success: false,
      statusCode: 500,
      latencyMs: 9,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    await insertCheck(pool, {
      targetId: asTargetId(id),
      checkedAt: newer,
      success: true,
      statusCode: 200,
      latencyMs: 42,
      errorCode: null,
      errorMessage: null,
    });

    const listed = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}/checks`,
      headers: { cookie: auth.header },
    });
    expect(listed.statusCode).toBe(200);
    const items = listed.json().items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      success: true,
      status_code: 200,
      latency_ms: 42,
      checked_at: newer.toISOString(),
    });
    expect(items[1]).toMatchObject({ success: false, status_code: 500, latency_ms: 9 });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: auth.header },
    });
    expect(detail.json().latency_ms).toBe(42);
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/v1/targets',
      headers: { cookie: auth.header },
    });
    expect(dashboard.json().items[0].latency_ms).toBe(42);
  });

  it('returns 401/403/404 on the checks list', async () => {
    const owner = await register(app, 'a@example.com');
    const other = await register(app, 'b@example.com');
    const id = await createTarget(owner);
    const unauth = await app.inject({ method: 'GET', url: `/api/v1/targets/${id}/checks` });
    expect(unauth.statusCode).toBe(401);
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}/checks`,
      headers: { cookie: other.header },
    });
    expect(forbidden.statusCode).toBe(403);
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${randomUUID()}/checks`,
      headers: { cookie: owner.header },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('sets next_check_at to now without probing and enforces authz', async () => {
    const owner = await register(app, 'owner-now@example.com');
    const other = await register(app, 'other-now@example.com');
    const id = await createTarget(owner);
    const future = new Date('2026-10-17T12:05:00.000Z');
    await pool.query('UPDATE targets SET next_check_at = $2 WHERE id = $1', [id, future]);
    const before = await findTargetById(pool, asTargetId(id));
    expect(before?.nextCheckAt).toEqual(future);

    const unauth = await app.inject({ method: 'POST', url: `/api/v1/targets/${id}/check-now` });
    expect(unauth.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/targets/${id}/check-now`,
      headers: { cookie: other.header, 'x-csrf-token': other.csrf },
    });
    expect(forbidden.statusCode).toBe(403);
    expect((await findTargetById(pool, asTargetId(id)))?.nextCheckAt).toEqual(before?.nextCheckAt);

    const missing = await app.inject({
      method: 'POST',
      url: `/api/v1/targets/${randomUUID()}/check-now`,
      headers: { cookie: owner.header, 'x-csrf-token': owner.csrf },
    });
    expect(missing.statusCode).toBe(404);

    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/targets/${id}/check-now`,
      headers: { cookie: owner.header, 'x-csrf-token': owner.csrf },
    });
    expect(ok.statusCode).toBe(200);
    const after = await findTargetById(pool, asTargetId(id));
    expect(after?.nextCheckAt).toEqual(NOW);
    expect(ok.json()).toMatchObject({ id, latency_ms: null });
  });
});
