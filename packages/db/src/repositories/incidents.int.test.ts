import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction, type DbPool } from '../index.js';
import { insertUser } from './users.js';
import { insertTarget } from './targets.js';
import { insertCheck } from './checks.js';
import { findOpenIncident, insertOpenIncident, listIncidentsForTarget } from './incidents.js';
import { openTestPool, requireDatabaseUrl, resetDb } from '../test/harness.js';

const skip = !requireDatabaseUrl();

describe.skipIf(skip)('incidents unique open index', () => {
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

  it('treats a second concurrent open as a no-op so one open row remains', async () => {
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
    const checkA = await insertCheck(pool, {
      targetId: target.id,
      checkedAt: now,
      success: false,
      statusCode: 500,
      latencyMs: 1,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });
    const checkB = await insertCheck(pool, {
      targetId: target.id,
      checkedAt: now,
      success: false,
      statusCode: 500,
      latencyMs: 1,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 500',
    });

    await Promise.all([
      withTransaction(pool, (tx) =>
        insertOpenIncident(tx, { targetId: target.id, openedAt: now, triggerCheckId: checkA.id }),
      ),
      withTransaction(pool, (tx) =>
        insertOpenIncident(tx, { targetId: target.id, openedAt: now, triggerCheckId: checkB.id }),
      ),
    ]);

    const open = await findOpenIncident(pool, target.id);
    expect(open).toBeDefined();
    expect(await listIncidentsForTarget(pool, target.id)).toHaveLength(1);
  });
});
