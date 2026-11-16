import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asTargetId } from '@beacon-watch/domain';
import { insertCheck, insertOpenIncident, resolveIncident, type DbPool } from '@beacon-watch/db';
import { buildTestApp, openTestPool, parseCookies, requireDatabaseUrl, resetDb } from './test/harness.js';

const skip = !requireDatabaseUrl();
const NOW = new Date('2026-10-15T00:05:00.000Z');

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

describe.skipIf(skip)('incident timeline', () => {
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

  it('returns open and resolved incidents newest first with duration', async () => {
    const auth = await register(app, 'owner@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Homepage', url: 'https://example.com/health' },
    });
    expect(created.statusCode).toBe(201);
    const targetId = asTargetId(created.json().id as string);

    const olderOpened = new Date('2026-10-15T00:00:00.000Z');
    const olderResolved = new Date('2026-10-15T00:00:40.000Z');
    const newerOpened = new Date('2026-10-15T00:02:00.000Z');

    const trip = await insertCheck(pool, {
      targetId,
      checkedAt: olderOpened,
      success: false,
      statusCode: 500,
      latencyMs: 1,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    const recover = await insertCheck(pool, {
      targetId,
      checkedAt: olderResolved,
      success: true,
      statusCode: 200,
      latencyMs: 1,
      errorCode: null,
      errorMessage: null,
    });
    const resolved = await insertOpenIncident(pool, {
      targetId,
      openedAt: olderOpened,
      triggerCheckId: trip.id,
    });
    expect(resolved).toBeDefined();
    await resolveIncident(pool, resolved!.id, { resolvedAt: olderResolved, resolveCheckId: recover.id });

    const reopen = await insertCheck(pool, {
      targetId,
      checkedAt: newerOpened,
      success: false,
      statusCode: 500,
      latencyMs: 1,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    await insertOpenIncident(pool, { targetId, openedAt: newerOpened, triggerCheckId: reopen.id });

    const listed = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${targetId}/incidents`,
      headers: { cookie: auth.header },
    });
    expect(listed.statusCode).toBe(200);
    const items = listed.json().items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      status: 'open',
      opened_at: newerOpened.toISOString(),
      resolved_at: null,
      trigger_check_id: reopen.id,
      duration_seconds: 180,
    });
    expect(items[1]).toMatchObject({
      status: 'resolved',
      opened_at: olderOpened.toISOString(),
      resolved_at: olderResolved.toISOString(),
      trigger_check_id: trip.id,
      duration_seconds: 40,
    });
  });

  it('returns 403 for a non-owner and 404 for an unknown id', async () => {
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
      url: `/api/v1/targets/${id}/incidents`,
      headers: { cookie: other.header },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(forbidden.json().error.request_id).toEqual(expect.any(String));
    expect(forbidden.json()).not.toHaveProperty('items');
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${randomUUID()}/incidents`,
      headers: { cookie: owner.header },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('returns 200 for the owner, 401 without a session, and 400 for a non-uuid id', async () => {
    const owner = await register(app, 'owner-authz@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: owner.header, 'x-csrf-token': owner.csrf },
      payload: { name: 'Owned', url: 'https://example.com' },
    });
    const id = created.json().id as string;
    const ok = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}/incidents`,
      headers: { cookie: owner.header },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ items: [] });
    const unauth = await app.inject({ method: 'GET', url: `/api/v1/targets/${id}/incidents` });
    expect(unauth.statusCode).toBe(401);
    expect(unauth.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/targets/not-a-uuid/incidents',
      headers: { cookie: owner.header },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});
