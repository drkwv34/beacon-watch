import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../index.js';
import { loadPublicStatusBySlug } from '../public-status.js';
import { insertUser } from './users.js';
import { findPublicTargetBySlug, insertTarget, setNextCheckAt, updateTargetAfterCheck } from './targets.js';
import {
  countChecksSince,
  countSuccessfulChecksForTarget,
  findLatestCheck,
  insertCheck,
  latestLatencyByTargetIds,
} from './checks.js';
import { openTestPool, requireDatabaseUrl, resetDb } from '../test/harness.js';

const skip = !requireDatabaseUrl();

describe.skipIf(skip)('public status queries', () => {
  let pool: DbPool;

  beforeAll(async () => {
    pool = await openTestPool();
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('finds only public slugs and aggregates latest check plus 24h uptime counts', async () => {
    const user = await insertUser(pool, { email: 'owner@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-16T12:00:00.000Z');
    const publicTarget = await insertTarget(pool, {
      userId: user.id,
      name: 'Portfolio demo API',
      url: 'http://mock-target:8080/health',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 500,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: true,
      isPublic: true,
      publicSlug: 'portfolio-demo',
      now,
    });
    await insertTarget(pool, {
      userId: user.id,
      name: 'Secret',
      url: 'http://mock-target:8080/health',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 500,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: true,
      isPublic: false,
      publicSlug: 'secret-slug',
      now,
    });

    expect(await findPublicTargetBySlug(pool, 'portfolio-demo')).toMatchObject({ id: publicTarget.id });
    expect(await findPublicTargetBySlug(pool, 'secret-slug')).toBeUndefined();
    expect(await findPublicTargetBySlug(pool, 'missing')).toBeUndefined();

    const older = new Date('2026-10-15T11:00:00.000Z');
    const inside = new Date('2026-10-15T13:00:00.000Z');
    const latestAt = new Date('2026-10-16T11:59:00.000Z');
    await insertCheck(pool, {
      targetId: publicTarget.id,
      checkedAt: older,
      success: true,
      statusCode: 200,
      latencyMs: 9,
      errorCode: null,
      errorMessage: null,
    });
    await insertCheck(pool, {
      targetId: publicTarget.id,
      checkedAt: inside,
      success: true,
      statusCode: 200,
      latencyMs: 10,
      errorCode: null,
      errorMessage: null,
    });
    await insertCheck(pool, {
      targetId: publicTarget.id,
      checkedAt: latestAt,
      success: false,
      statusCode: 500,
      latencyMs: 11,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });

    const latest = await findLatestCheck(pool, publicTarget.id);
    expect(latest?.latencyMs).toBe(11);
    expect(latest?.success).toBe(false);

    const since = new Date('2026-10-15T12:00:00.000Z');
    expect(await countChecksSince(pool, publicTarget.id, since)).toEqual({ total: 2, successes: 1 });
    expect(await countSuccessfulChecksForTarget(pool, publicTarget.id)).toBe(2);
    expect(await latestLatencyByTargetIds(pool, [publicTarget.id])).toEqual(new Map([[publicTarget.id, 11]]));

    const due = new Date('2026-10-16T12:00:01.000Z');
    const scheduled = await setNextCheckAt(pool, publicTarget.id, due, due);
    expect(scheduled?.nextCheckAt).toEqual(due);
  });

  it('loads a strict public DTO and hides private or unknown slugs', async () => {
    const user = await insertUser(pool, { email: 'dto@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-16T12:00:00.000Z');
    await insertTarget(pool, {
      userId: user.id,
      name: 'Public demo',
      url: 'http://mock-target:8080/health',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 500,
      expectedStatus: 200,
      headers: { Authorization: 'secret' },
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: true,
      isPublic: true,
      publicSlug: 'public-dto',
      now,
    });
    await insertTarget(pool, {
      userId: user.id,
      name: 'Secret',
      url: 'http://mock-target:8080/health',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 500,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: true,
      isPublic: false,
      publicSlug: 'secret-dto',
      now,
    });
    const latestAt = new Date('2026-10-16T11:59:00.000Z');
    const publicRow = await findPublicTargetBySlug(pool, 'public-dto');
    expect(publicRow).toBeDefined();
    await insertCheck(pool, {
      targetId: publicRow!.id,
      checkedAt: latestAt,
      success: true,
      statusCode: 200,
      latencyMs: 17,
      errorCode: null,
      errorMessage: null,
    });
    await updateTargetAfterCheck(pool, publicRow!.id, {
      lastCheckedAt: latestAt,
      lastStatus: 'up',
      consecutiveFailures: 0,
      consecutiveSuccesses: 1,
      now: latestAt,
    });

    const payload = await loadPublicStatusBySlug(pool, 'public-dto', now);
    expect(payload).toMatchObject({
      name: 'Public demo',
      status: 'up',
      latency_ms: 17,
      check_count: 1,
      ever_succeeded: true,
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(
      [
        'check_count',
        'ever_succeeded',
        'last_checked_at',
        'latency_ms',
        'name',
        'open_incident',
        'recent_incidents',
        'status',
        'uptime_24h',
      ].sort(),
    );
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('url');
    expect(payload).not.toHaveProperty('userId');
    expect(JSON.stringify(payload)).not.toMatch(/Authorization|mock-target:8080|secret-dto/);
    expect(await loadPublicStatusBySlug(pool, 'secret-dto', now)).toBeUndefined();
    expect(await loadPublicStatusBySlug(pool, 'missing-dto', now)).toBeUndefined();
  });
});
