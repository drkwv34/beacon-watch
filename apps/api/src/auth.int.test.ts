import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '@beacon-watch/db';
import { requireDatabaseUrl, openTestPool, parseCookies, resetDb, buildTestApp } from './test/harness.js';

const skip = !requireDatabaseUrl();

describe.skipIf(skip)('auth integration', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    pool = await openTestPool();
    app = await buildTestApp({ pool });
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('registers, logs in, and returns me', async () => {
    const email = 'owner@example.com';
    const password = 'correct-horse';
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password },
    });
    expect(created.statusCode).toBe(201);
    const cookies = parseCookies(created.headers['set-cookie']);
    expect(created.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/beacon_session=.*HttpOnly/i),
        expect.stringMatching(/SameSite=Lax/i),
      ]),
    );
    const setCookie = created.headers['set-cookie'];
    const cookieBlob = Array.isArray(setCookie) ? setCookie.join(',') : (setCookie ?? '');
    expect(cookieBlob).not.toMatch(/Secure/i);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: cookies.header },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { email } });
    expect(JSON.stringify(me.json())).not.toContain('password');

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
  });

  it('rejects a duplicate email with 409', async () => {
    const payload = { email: 'dup@example.com', password: 'password12' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload })).statusCode).toBe(201);
    const again = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('rejects a wrong password with the same 401 as an unknown email', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'a@example.com', password: 'password12' },
    });
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'a@example.com', password: 'nope-nope' },
    });
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'missing@example.com', password: 'password12' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(missing.json().error.message);
  });

  it('revokes the session on logout', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'out@example.com', password: 'password12' },
    });
    const cookies = parseCookies(created.headers['set-cookie']);
    const loggedOut = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: cookies.header, 'x-csrf-token': cookies.csrf },
    });
    expect(loggedOut.statusCode).toBe(204);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: cookies.header },
    });
    expect(me.statusCode).toBe(401);
  });

  it('rejects mutating requests without a matching CSRF token', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'csrf@example.com', password: 'password12' },
    });
    const cookies = parseCookies(created.headers['set-cookie']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: cookies.header },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    const still = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: cookies.header },
    });
    expect(still.statusCode).toBe(200);
  });
});
