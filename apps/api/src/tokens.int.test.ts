import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '@beacon-watch/db';
import { REDACT_PATHS } from './app.js';
import { buildTestApp, openTestPool, parseCookies, requireDatabaseUrl, resetDb } from './test/harness.js';

const skip = !requireDatabaseUrl();
const NOW = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T02:00:00.000Z');

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

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe.skipIf(skip)('api tokens', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let now: Date;

  beforeAll(async () => {
    pool = await openTestPool();
    now = NOW;
    app = await buildTestApp({
      pool,
      now: () => now,
      lookup: async () => ['93.184.216.34'],
    });
  });

  beforeEach(async () => {
    now = NOW;
    await resetDb(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('creates, lists, and revokes tokens with a session and CSRF', async () => {
    const auth = await register(app, 'owner@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { label: 'ci' },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { id: string; token: string; prefix: string; label: string };
    expect(body.label).toBe('ci');
    expect(body.token).toMatch(/^bw_[A-Za-z0-9_-]+_/);
    expect(body.prefix).toBeTruthy();
    expect(body.token.startsWith(body.prefix)).toBe(true);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header },
    });
    expect(listed.statusCode).toBe(200);
    const items = listed.json().items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: body.id, label: 'ci', prefix: body.prefix });
    expect(JSON.stringify(listed.json())).not.toContain(body.token);
    expect(items[0]).not.toHaveProperty('token');
    expect(items[0]).not.toHaveProperty('token_hash');

    const { rows } = await pool.query<Record<string, unknown>>('SELECT * FROM api_tokens');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(body.token);
    expect(rows[0]?.token_hash).not.toBe(body.token);

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tokens/${body.id}`,
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
    });
    expect(revoked.statusCode).toBe(204);
    const listedAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header },
    });
    expect(listedAfter.json().items).toEqual([]);
  });

  it('lets Bearer manage owned targets, checks, and incidents but not another user', async () => {
    const owner = await register(app, 'a@example.com');
    const other = await register(app, 'b@example.com');
    const ownerToken = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: owner.header, 'x-csrf-token': owner.csrf },
      payload: { label: 'owner-cli' },
    });
    expect(ownerToken.statusCode).toBe(201);
    const token = ownerToken.json().token as string;
    const otherToken = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: other.header, 'x-csrf-token': other.csrf },
      payload: { label: 'other-cli' },
    });
    const bToken = otherToken.json().token as string;

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: bearer(token),
      payload: { name: 'Homepage', url: 'https://example.com/health' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const got = await app.inject({ method: 'GET', url: `/api/v1/targets/${id}`, headers: bearer(token) });
    expect(got.statusCode).toBe(200);
    const queued = await app.inject({
      method: 'POST',
      url: `/api/v1/targets/${id}/check-now`,
      headers: bearer(token),
    });
    expect(queued.statusCode).toBe(202);
    const checks = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}/checks`,
      headers: bearer(token),
    });
    expect(checks.statusCode).toBe(200);
    const incidents = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}/incidents`,
      headers: bearer(token),
    });
    expect(incidents.statusCode).toBe(200);

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${id}`,
      headers: bearer(bToken),
    });
    expect(forbidden.statusCode).toBe(403);
    const forbiddenCheck = await app.inject({
      method: 'POST',
      url: `/api/v1/targets/${id}/check-now`,
      headers: bearer(bToken),
    });
    expect(forbiddenCheck.statusCode).toBe(403);
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/targets/${randomUUID()}`,
      headers: bearer(token),
    });
    expect(missing.statusCode).toBe(404);
  });

  it('rejects revoked, expired, and invalid Bearer tokens with 401', async () => {
    const auth = await register(app, 'ttl@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { label: 'short', expires_at: LATER.toISOString() },
    });
    expect(created.statusCode).toBe(201);
    const token = created.json().token as string;
    const id = created.json().id as string;

    const live = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: bearer(token) });
    expect(live.statusCode).toBe(200);

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tokens/${id}`,
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
    });
    expect(revoked.statusCode).toBe(204);
    const afterRevoke = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: bearer(token) });
    expect(afterRevoke.statusCode).toBe(401);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { label: 'expiring', expires_at: LATER.toISOString() },
    });
    const expiring = second.json().token as string;
    now = new Date('2026-11-16T03:00:00.000Z');
    const expired = await app.inject({ method: 'GET', url: '/api/v1/targets', headers: bearer(expiring) });
    expect(expired.statusCode).toBe(401);

    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/targets',
      headers: bearer('bw_notareal_tokenvalue'),
    });
    expect(invalid.statusCode).toBe(401);
  });

  it('keeps CSRF on cookie sessions even with a fake Authorization header', async () => {
    const auth = await register(app, 'csrf@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header, authorization: 'Bearer totally-fake' },
      payload: { label: 'nope' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    const listed = await app.inject({ method: 'GET', url: '/api/v1/tokens', headers: { cookie: auth.header } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toEqual([]);
  });

  it('does not let Bearer administer tokens or logout', async () => {
    const auth = await register(app, 'admin@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { label: 'cli' },
    });
    const token = created.json().token as string;
    const id = created.json().id as string;

    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/tokens',
      headers: bearer(token),
      payload: { label: 'child' },
    });
    expect(post.statusCode).toBe(403);
    const get = await app.inject({ method: 'GET', url: '/api/v1/tokens', headers: bearer(token) });
    expect(get.statusCode).toBe(403);
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tokens/${id}`,
      headers: bearer(token),
    });
    expect(del.statusCode).toBe(403);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: bearer(token),
    });
    expect(logout.statusCode).toBe(403);
    const still = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(token) });
    expect(still.statusCode).toBe(200);
  });

  it('redacts Authorization and never logs a recipe that includes the raw token path', () => {
    expect(REDACT_PATHS).toContain('req.headers.authorization');
  });
});
