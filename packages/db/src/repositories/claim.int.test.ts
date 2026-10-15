import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction, type DbPool } from '../index.js';
import { insertUser } from './users.js';
import { claimDueTargets, insertTarget } from './targets.js';
import { openTestPool, requireDatabaseUrl, resetDb } from '../test/harness.js';

const skip = !requireDatabaseUrl();

describe.skipIf(skip)('claimDueTargets SKIP LOCKED', () => {
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

  it('never lets two concurrent workers claim the same due row', async () => {
    const user = await insertUser(pool, { email: 'owner@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-15T00:00:00.000Z');
    const target = await insertTarget(pool, {
      userId: user.id,
      name: 'Homepage',
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
      publicSlug: null,
      now,
    });

    const [first, second] = await Promise.all([
      withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10, random: () => 0 })),
      withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10, random: () => 0 })),
    ]);

    const ids = [...first, ...second].map((row) => row.id);
    expect(ids).toEqual([target.id]);
    expect(first.length + second.length).toBe(1);
  });

  it('skips disabled targets and leases claimed rows out of the due set', async () => {
    const user = await insertUser(pool, { email: 'owner@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-15T00:00:00.000Z');
    await insertTarget(pool, {
      userId: user.id,
      name: 'Paused',
      url: 'http://mock-target:8080/health',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 500,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: false,
      isPublic: false,
      publicSlug: null,
      now,
    });
    const due = await insertTarget(pool, {
      userId: user.id,
      name: 'Live',
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
      publicSlug: null,
      now,
    });

    const claimed = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10, random: () => 0 }));
    expect(claimed.map((row) => row.id)).toEqual([due.id]);
    expect(claimed[0]?.nextCheckAt.toISOString()).toBe('2026-10-15T00:01:00.000Z');

    const again = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10, random: () => 0 }));
    expect(again).toEqual([]);
  });
});
