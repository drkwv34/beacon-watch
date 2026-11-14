import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction, type DbPool } from '../index.js';
import { insertUser } from './users.js';
import { claimDueTargets, insertTarget, requestManualCheck, renewProbeLease } from './targets.js';
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
      withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 })),
      withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 })),
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

    const claimed = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 }));
    expect(claimed.map((row) => row.id)).toEqual([due.id]);
    expect(claimed[0]?.nextCheckAt.toISOString()).toBe(now.toISOString());
    expect(claimed[0]?.probeLeaseToken).toEqual(expect.any(String));
    expect(claimed[0]?.probeLeaseExpiresAt).toBeInstanceOf(Date);
    expect(claimed[0]?.manualCheckRequested).toBe(false);

    const again = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 }));
    expect(again).toEqual([]);
  });

  it('reclaims an expired lease and ignores a stale owner token', async () => {
    const user = await insertUser(pool, { email: 'owner@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-15T00:00:00.000Z');
    const target = await insertTarget(pool, {
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

    const [first] = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 1 }));
    const staleToken = first?.probeLeaseToken;
    expect(staleToken).toEqual(expect.any(String));

    const expired = new Date('2026-10-14T23:59:59.000Z');
    await pool.query('UPDATE targets SET probe_lease_expires_at = $2 WHERE id = $1', [target.id, expired]);

    const [second] = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 1 }));
    expect(second?.id).toBe(target.id);
    expect(second?.probeLeaseToken).toBeTruthy();
    expect(second?.probeLeaseToken).not.toBe(staleToken);

    const renewed = await renewProbeLease(pool, target.id, staleToken!, new Date('2026-10-15T00:10:00.000Z'), now);
    expect(renewed).toBe(false);
    const row = await pool.query('SELECT probe_lease_token FROM targets WHERE id = $1', [target.id]);
    expect(row.rows[0]?.probe_lease_token).toBe(second?.probeLeaseToken);
  });

  it('advances an idle target on manual check and leaves a leased row unchanged', async () => {
    const user = await insertUser(pool, { email: 'owner@example.com', passwordHash: 'x'.repeat(32) });
    const now = new Date('2026-10-15T00:00:00.000Z');
    const later = new Date('2026-10-15T01:00:00.000Z');
    const target = await insertTarget(pool, {
      userId: user.id,
      name: 'Idle',
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
    await pool.query('UPDATE targets SET next_check_at = $2 WHERE id = $1', [target.id, later]);

    const idleClaim = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 }));
    expect(idleClaim).toEqual([]);

    const requested = await withTransaction(pool, (tx) => requestManualCheck(tx, target.id, now));
    expect(requested?.nextCheckAt.toISOString()).toBe(now.toISOString());
    expect(requested?.manualCheckRequested).toBe(true);

    const claimed = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 }));
    expect(claimed).toHaveLength(1);
    const token = claimed[0]?.probeLeaseToken;
    expect(claimed[0]?.manualCheckRequested).toBe(false);

    const coalesced = await withTransaction(pool, (tx) => requestManualCheck(tx, target.id, now));
    expect(coalesced?.probeLeaseToken).toBe(token);
    expect(coalesced?.nextCheckAt.toISOString()).toBe(now.toISOString());
    expect(coalesced?.manualCheckRequested).toBe(false);

    const again = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 10 }));
    expect(again).toEqual([]);
  });
});
