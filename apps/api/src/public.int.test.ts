import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertCheck, insertOpenIncident, updateTargetAfterCheck, type DbPool } from '@beacon-watch/db';
import { asTargetId, statusPageKey, targetLatestKey } from '@beacon-watch/domain';
import { createRedis, RedisCache } from './cache/redis-cache.js';
import { PublicStatusService } from './modules/public-status/service.js';
import { PublicStatusBody } from './modules/public-status/schemas.js';
import {
  buildTestApp,
  openTestPool,
  parseCookies,
  requireDatabaseUrl,
  requireRedisUrl,
  resetDb,
  testConfig,
} from './test/harness.js';

const skip = !requireDatabaseUrl() || !requireRedisUrl();
const NOW = new Date('2026-10-16T12:00:00.000Z');
const NOT_FOUND = { code: 'NOT_FOUND', message: 'Status page not found' };

let ipSeq = 10;
function nextIp(): string {
  ipSeq += 1;
  return `203.0.113.${ipSeq}`;
}

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

describe.skipIf(skip)('public status API', () => {
  let pool: DbPool;
  let redis: ReturnType<typeof createRedis>;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    pool = await openTestPool();
    redis = createRedis({
      url: requireRedisUrl(),
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    await redis.connect();
    app = await buildTestApp({
      pool,
      redis,
      now: () => NOW,
      lookup: async () => ['93.184.216.34'],
    });
  });

  beforeEach(async () => {
    await resetDb(pool);
    await redis.flushall();
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
    await pool.end();
  });

  async function createPublicTarget(
    slug = 'portfolio-demo',
    extra: Record<string, unknown> = {},
  ): Promise<{ id: ReturnType<typeof asTargetId>; auth: { header: string; csrf: string } }> {
    const auth = await register(app, `owner-${crypto.randomUUID()}@example.com`);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: {
        name: 'Portfolio demo API',
        url: 'https://example.com/health',
        is_public: true,
        public_slug: slug,
        ...extra,
      },
    });
    expect(created.statusCode).toBe(201);
    return { id: asTargetId(created.json().id as string), auth };
  }

  async function seedUpTarget(slug = 'portfolio-demo') {
    const { id, auth } = await createPublicTarget(slug);
    const checkedAt = new Date('2026-10-16T11:59:00.000Z');
    await insertCheck(pool, {
      targetId: id,
      checkedAt,
      success: true,
      statusCode: 200,
      latencyMs: 42,
      errorCode: null,
      errorMessage: null,
    });
    await updateTargetAfterCheck(pool, id, {
      lastCheckedAt: checkedAt,
      lastStatus: 'up',
      consecutiveFailures: 0,
      consecutiveSuccesses: 1,
      now: checkedAt,
    });
    return { id, auth };
  }

  it('returns Appendix A JSON for a public slug', async () => {
    await seedUpTarget();
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(200);
    const body = PublicStatusBody.parse(res.json());
    expect(body).toEqual({
      name: 'Portfolio demo API',
      status: 'up',
      last_checked_at: '2026-10-16T11:59:00.000Z',
      latency_ms: 42,
      uptime_24h: 1,
      open_incident: null,
      check_count: 1,
      ever_succeeded: true,
      recent_incidents: [],
    });
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('url');
    expect(res.headers['x-ratelimit-limit']).toBe('60');
    expect(res.headers['x-ratelimit-remaining']).toBe('59');
  });

  it('returns open_incident duration when down', async () => {
    const { id } = await createPublicTarget('down-demo');
    const openedAt = new Date('2026-10-16T11:04:00.000Z');
    const trip = await insertCheck(pool, {
      targetId: id,
      checkedAt: openedAt,
      success: false,
      statusCode: 500,
      latencyMs: null,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    await updateTargetAfterCheck(pool, id, {
      lastCheckedAt: openedAt,
      lastStatus: 'down',
      consecutiveFailures: 2,
      consecutiveSuccesses: 0,
      now: openedAt,
    });
    await insertOpenIncident(pool, { targetId: id, openedAt, triggerCheckId: trip.id });
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/down-demo',
      remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'down',
      latency_ms: null,
      open_incident: { opened_at: openedAt.toISOString(), duration_seconds: 3360 },
    });
  });

  it('returns null uptime when there are no checks', async () => {
    await createPublicTarget('empty-demo');
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/empty-demo',
      remoteAddress: nextIp(),
    });
    expect(res.json()).toMatchObject({
      last_checked_at: null,
      latency_ms: null,
      uptime_24h: null,
      open_incident: null,
      check_count: 0,
      ever_succeeded: false,
      recent_incidents: [],
    });
  });

  it('reports never-succeeded after only failed checks and lists recent incidents without ids', async () => {
    const { id } = await createPublicTarget('fail-demo');
    const openedAt = new Date('2026-10-16T11:04:00.000Z');
    const trip = await insertCheck(pool, {
      targetId: id,
      checkedAt: openedAt,
      success: false,
      statusCode: 500,
      latencyMs: null,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    await updateTargetAfterCheck(pool, id, {
      lastCheckedAt: openedAt,
      lastStatus: 'down',
      consecutiveFailures: 2,
      consecutiveSuccesses: 0,
      now: openedAt,
    });
    await insertOpenIncident(pool, { targetId: id, openedAt, triggerCheckId: trip.id });
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/fail-demo',
      remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(200);
    const body = PublicStatusBody.parse(res.json());
    expect(body).toMatchObject({
      check_count: 1,
      ever_succeeded: false,
      recent_incidents: [{ status: 'open', opened_at: openedAt.toISOString(), resolved_at: null }],
    });
    expect(JSON.stringify(body.recent_incidents)).not.toMatch(/id/);
    expect(body).not.toHaveProperty('url');
  });

  it('returns identical 404 bodies for private, slugless, and unknown slugs', async () => {
    const auth = await register(app, `priv-${crypto.randomUUID()}@example.com`);
    const privateTarget = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Secret', url: 'https://example.com/health', is_public: false, public_slug: 'secret-slug' },
    });
    expect(privateTarget.statusCode).toBe(201);
    const slugless = await app.inject({
      method: 'POST',
      url: '/api/v1/targets',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'No slug', url: 'https://example.com/health' },
    });
    expect(slugless.statusCode).toBe(201);

    const ip = nextIp();
    const privateRes = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/secret-slug',
      remoteAddress: ip,
    });
    const unknownRes = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/definitely-missing',
      remoteAddress: ip,
    });
    const sluglessRes = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/unused-slug',
      remoteAddress: ip,
    });
    expect(privateRes.statusCode).toBe(404);
    expect(unknownRes.statusCode).toBe(404);
    expect(sluglessRes.statusCode).toBe(404);
    expect(privateRes.json().error).toMatchObject(NOT_FOUND);
    expect(unknownRes.json().error).toMatchObject(NOT_FOUND);
    expect(sluglessRes.json().error).toMatchObject(NOT_FOUND);
    const strip = (body: { error: { code: string; message: string } }) => ({
      code: body.error.code,
      message: body.error.message,
    });
    expect(strip(privateRes.json())).toEqual(strip(unknownRes.json()));
    expect(strip(unknownRes.json())).toEqual(strip(sluglessRes.json()));
    for (const res of [privateRes, unknownRes, sluglessRes]) {
      const body = res.json() as Record<string, unknown>;
      expect(body).not.toHaveProperty('id');
      expect(body).not.toHaveProperty('url');
      expect(JSON.stringify(strip(res.json()))).not.toMatch(/example\.com/);
    }
  });

  it('rate-limits a small burst from one IP and leaves a second IP unaffected', async () => {
    await seedUpTarget('burst-demo');
    const burstApp = await buildTestApp({
      pool,
      redis,
      now: () => NOW,
      config: testConfig({ PUBLIC_RATE_LIMIT_PER_MIN: '3' }),
      lookup: async () => ['93.184.216.34'],
    });
    const ipA = nextIp();
    const ipB = nextIp();
    let last = await burstApp.inject({
      method: 'GET',
      url: '/api/public/v1/status/burst-demo',
      remoteAddress: ipA,
    });
    for (let i = 0; i < 2; i += 1) {
      last = await burstApp.inject({
        method: 'GET',
        url: '/api/public/v1/status/burst-demo',
        remoteAddress: ipA,
      });
    }
    expect(last.statusCode).toBe(200);
    expect(last.headers['x-ratelimit-limit']).toBe('3');
    expect(last.headers['x-ratelimit-remaining']).toBe('0');
    const limited = await burstApp.inject({
      method: 'GET',
      url: '/api/public/v1/status/burst-demo',
      remoteAddress: ipA,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeTruthy();
    const other = await burstApp.inject({
      method: 'GET',
      url: '/api/public/v1/status/burst-demo',
      remoteAddress: ipB,
    });
    expect(other.statusCode).toBe(200);
    await burstApp.close();
  });

  it('rate-limits the 61st request from one IP and leaves a second IP unaffected', async () => {
    await seedUpTarget();
    const ipA = nextIp();
    const ipB = nextIp();
    let last = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: ipA,
    });
    for (let i = 0; i < 59; i += 1) {
      last = await app.inject({
        method: 'GET',
        url: '/api/public/v1/status/portfolio-demo',
        remoteAddress: ipA,
      });
    }
    expect(last.statusCode).toBe(200);
    expect(last.headers['x-ratelimit-remaining']).toBe('0');
    const limited = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: ipA,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(limited.headers['x-ratelimit-limit']).toBe('60');
    expect(limited.headers['x-ratelimit-remaining']).toBe('0');

    const other = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: ipB,
    });
    expect(other.statusCode).toBe(200);

    const { auth } = await createPublicTarget('auth-not-limited');
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/v1/targets',
      headers: { cookie: auth.header },
      remoteAddress: ipA,
    });
    expect(dashboard.statusCode).toBe(200);
  });

  it('serves the same JSON body from Postgres after FLUSHALL', async () => {
    await seedUpTarget();
    const ip = nextIp();
    const warm = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: ip,
    });
    expect(warm.statusCode).toBe(200);
    const body = warm.json();
    await redis.flushall();
    const cold = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: nextIp(),
    });
    expect(cold.statusCode).toBe(200);
    expect(cold.json()).toEqual(body);
  });

  it('fails closed with 503 when Redis is unreachable while the DB path still works', async () => {
    await seedUpTarget();
    const dead = createRedis({
      url: 'redis://127.0.0.1:9',
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    const downApp = await buildTestApp({
      pool,
      redis: dead,
      now: () => NOW,
      lookup: async () => ['93.184.216.34'],
    });
    const res = await downApp.inject({
      method: 'GET',
      url: '/api/public/v1/status/portfolio-demo',
      remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('DEPENDENCY_UNAVAILABLE');
    await downApp.close();
    dead.disconnect();

    const service = new PublicStatusService(pool, undefined, () => NOW);
    const fromDb = await service.loadFromDb('portfolio-demo');
    expect(fromDb).toMatchObject({ name: 'Portfolio demo API', status: 'up', latency_ms: 42 });
  });

  it('invalidates statuspage and latest keys on target update', async () => {
    const { id, auth } = await seedUpTarget('invalidate-me');
    const cache = new RedisCache(redis, { warn: () => undefined });
    await cache.setStatusPage(
      'invalidate-me',
      {
        name: 'stale',
        status: 'up',
        last_checked_at: NOW.toISOString(),
        latency_ms: 1,
        uptime_24h: 1,
        open_incident: null,
        check_count: 1,
        ever_succeeded: true,
        recent_incidents: [],
      },
      15,
    );
    await redis.set(targetLatestKey(id), '{"v":1}');
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/targets/${id}`,
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf },
      payload: { name: 'Renamed' },
    });
    expect(patched.statusCode).toBe(200);
    expect(await redis.get(statusPageKey('invalidate-me'))).toBeNull();
    expect(await redis.get(targetLatestKey(id))).toBeNull();
  });

  it('does not allow CORS origins by default and allows a configured origin', async () => {
    await seedUpTarget('cors-demo');
    const denied = await app.inject({
      method: 'GET',
      url: '/api/public/v1/status/cors-demo',
      headers: { origin: 'https://evil.example' },
      remoteAddress: nextIp(),
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();

    const allowApp = await buildTestApp({
      pool,
      redis,
      now: () => NOW,
      config: testConfig({ PUBLIC_CORS_ORIGINS: 'https://status.example' }),
      lookup: async () => ['93.184.216.34'],
    });
    const allowed = await allowApp.inject({
      method: 'GET',
      url: '/api/public/v1/status/cors-demo',
      headers: { origin: 'https://status.example' },
      remoteAddress: nextIp(),
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://status.example');
    await allowApp.close();
  });

  it('marks Redis unavailable on /readyz without failing Postgres', async () => {
    const ok = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ status: 'ok', postgres: 'ok', redis: 'ok' });

    const dead = createRedis({
      url: 'redis://127.0.0.1:9',
      connectTimeoutMs: 200,
      commandTimeoutMs: 200,
    });
    const downApp = await buildTestApp({
      pool,
      redis: dead,
      now: () => NOW,
      lookup: async () => ['93.184.216.34'],
    });
    const degraded = await downApp.inject({ method: 'GET', url: '/readyz' });
    expect(degraded.statusCode).toBe(200);
    expect(degraded.json()).toEqual({ status: 'degraded', postgres: 'ok', redis: 'unavailable' });
    await downApp.close();
    dead.disconnect();
  });
});
