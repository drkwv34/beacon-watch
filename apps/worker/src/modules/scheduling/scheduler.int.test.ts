import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  claimDueTargets,
  countChecksForTarget,
  findOpenIncident,
  findTargetById,
  listChecksForTarget,
  listIncidentsForTarget,
  requestManualCheck,
  withTransaction,
  type DbPool,
} from '@beacon-watch/db';
import { persistCheck, tick } from './run-check.js';
import { createProbeClient, type ProbeClient, type ProbeOutcome, type ProbeTarget } from '../../probe/client.js';
import { HostSemaphore, Semaphore } from '../../pool/semaphore.js';
import {
  listenMockTarget,
  openTestPool,
  requireDatabaseUrl,
  resetDb,
  schedulerDeps,
  seedDueTarget,
} from '../../test/harness.js';

function failOutcome(): ProbeOutcome {
  return {
    success: false,
    statusCode: 500,
    latencyMs: 1,
    errorCode: 'UNEXPECTED_STATUS',
    errorMessage: 'status 500',
  };
}

function okOutcome(): ProbeOutcome {
  return { success: true, statusCode: 200, latencyMs: 1, errorCode: null, errorMessage: null };
}

const skip = !requireDatabaseUrl();

describe.skipIf(skip)('scheduler integration', () => {
  let pool: DbPool;
  let baseUrl = '';
  let closeServer: () => Promise<void> = async () => undefined;
  let probe: ProbeClient;

  beforeAll(async () => {
    pool = await openTestPool();
    const { server, port } = await listenMockTarget(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;
    probe = createProbeClient({ ssrfProtection: false, insecureTls: false });
    closeServer = () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await closeServer();
    await pool.end();
  });

  it('records a successful check against mock-target /health', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    const n = await tick(schedulerDeps(pool, probe, { now: () => now }));
    expect(n).toBe(1);
    const checks = await listChecksForTarget(pool, target.id);
    expect(checks).toHaveLength(1);
    expect(checks[0]?.success).toBe(true);
    expect(checks[0]?.statusCode).toBe(200);
    expect(checks[0]?.errorCode).toBeNull();
    const after = await findTargetById(pool, target.id);
    expect(after?.nextCheckAt.toISOString()).toBe('2026-10-15T00:01:00.000Z');
    expect(after?.probeLeaseToken).toBeNull();
    expect(after?.probeLeaseExpiresAt).toBeNull();
  });

  it('records TIMEOUT against mock-target /slow without hanging the pool', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const slow = await seedDueTarget(pool, now, { url: `${baseUrl}/slow?ms=5000`, timeoutMs: 500 });
    const healthy = await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    const started = Date.now();
    await tick(schedulerDeps(pool, probe, { now: () => now }));
    expect(Date.now() - started).toBeLessThan(4000);
    const slowChecks = await listChecksForTarget(pool, slow.id);
    const healthyChecks = await listChecksForTarget(pool, healthy.id);
    expect(slowChecks[0]?.success).toBe(false);
    expect(slowChecks[0]?.errorCode).toBe('TIMEOUT');
    expect(healthyChecks[0]?.success).toBe(true);
  });

  it('lets two workers claim once and write a single check row', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    const fakeProbe: ProbeClient = {
      async probe(_input: ProbeTarget): Promise<ProbeOutcome> {
        return { success: true, statusCode: 200, latencyMs: 1, errorCode: null, errorMessage: null };
      },
    };
    await Promise.all([
      tick(schedulerDeps(pool, fakeProbe, { now: () => now, global: new Semaphore(4), perHost: new HostSemaphore(2) })),
      tick(schedulerDeps(pool, fakeProbe, { now: () => now, global: new Semaphore(4), perHost: new HostSemaphore(2) })),
    ]);
    expect(await countChecksForTarget(pool, target.id)).toBe(1);
  });

  it('does not open an incident on fail then success', async () => {
    const t0 = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, t0);
    await persistCheck(pool, target.id, t0, failOutcome());
    await persistCheck(pool, target.id, new Date('2026-10-15T00:01:00.000Z'), okOutcome());
    expect(await listIncidentsForTarget(pool, target.id)).toEqual([]);
    const row = await findTargetById(pool, target.id);
    expect(row?.lastStatus).not.toBe('down');
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.consecutiveSuccesses).toBe(1);
  });

  it('opens on two failures, resolves on two successes, and never double-opens', async () => {
    const t0 = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, t0);
    await persistCheck(pool, target.id, t0, failOutcome());
    const openedAt = new Date('2026-10-15T00:01:00.000Z');
    const opened = await persistCheck(pool, target.id, openedAt, failOutcome());
    const afterOpen = await findTargetById(pool, target.id);
    expect(afterOpen?.lastStatus).toBe('down');
    const open = await findOpenIncident(pool, target.id);
    expect(open?.status).toBe('open');
    expect(open?.triggerCheckId).toBe(opened?.id);

    await persistCheck(pool, target.id, new Date('2026-10-15T00:02:00.000Z'), okOutcome());
    const resolvedAt = new Date('2026-10-15T00:03:00.000Z');
    await persistCheck(pool, target.id, resolvedAt, okOutcome());
    const incidents = await listIncidentsForTarget(pool, target.id);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.status).toBe('resolved');
    expect(incidents[0]?.resolvedAt?.toISOString()).toBe(resolvedAt.toISOString());
    expect(await findOpenIncident(pool, target.id)).toBeUndefined();
    const afterResolve = await findTargetById(pool, target.id);
    expect(afterResolve?.lastStatus).toBe('up');
  });

  it('lets two concurrent persist workers open only one incident', async () => {
    const t0 = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, t0);
    await persistCheck(pool, target.id, t0, failOutcome());
    const t1 = new Date('2026-10-15T00:01:00.000Z');
    await Promise.all([
      persistCheck(pool, target.id, t1, failOutcome()),
      persistCheck(pool, target.id, t1, failOutcome()),
    ]);
    expect(await listIncidentsForTarget(pool, target.id)).toHaveLength(1);
    expect(await findOpenIncident(pool, target.id)).toBeDefined();
  });

  it('caps in-flight probes at the global semaphore during tick', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    let current = 0;
    let peak = 0;
    const gated: ProbeClient = {
      async probe(_input: ProbeTarget): Promise<ProbeOutcome> {
        current += 1;
        peak = Math.max(peak, current);
        await new Promise((resolve) => {
          setTimeout(resolve, 40);
        });
        current -= 1;
        return okOutcome();
      },
    };
    const n = await tick(
      schedulerDeps(pool, gated, { now: () => now, global: new Semaphore(2), perHost: new HostSemaphore(4) }),
    );
    expect(n).toBe(2);
    expect(peak).toBe(2);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('caps in-flight probes per hostname during tick', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    let current = 0;
    let peak = 0;
    const gated: ProbeClient = {
      async probe(_input: ProbeTarget): Promise<ProbeOutcome> {
        current += 1;
        peak = Math.max(peak, current);
        await new Promise((resolve) => {
          setTimeout(resolve, 40);
        });
        current -= 1;
        return okOutcome();
      },
    };
    const n = await tick(
      schedulerDeps(pool, gated, { now: () => now, global: new Semaphore(4), perHost: new HostSemaphore(1) }),
    );
    expect(n).toBe(3);
    expect(peak).toBe(1);
  });

  it('runs exactly one probe per target when check-now arrives during in-flight work', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const targets = [];
    for (let i = 0; i < 6; i += 1) {
      targets.push(await seedDueTarget(pool, now, { url: `${baseUrl}/health?n=${i}`, timeoutMs: 4000 }));
    }

    let inFlight = 0;
    let peak = 0;
    let started = 0;
    let releaseFirstWave!: () => void;
    const firstWaveStarted = new Promise<void>((resolve) => {
      releaseFirstWave = resolve;
    });
    let releaseProbes!: () => void;
    const probesMayFinish = new Promise<void>((resolve) => {
      releaseProbes = resolve;
    });
    const probeCounts = new Map<string, number>();
    const gated: ProbeClient = {
      async probe(input: ProbeTarget): Promise<ProbeOutcome> {
        probeCounts.set(input.url, (probeCounts.get(input.url) ?? 0) + 1);
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        started += 1;
        if (started === 2) releaseFirstWave();
        await probesMayFinish;
        inFlight -= 1;
        return okOutcome();
      },
    };

    const workerA = tick(
      schedulerDeps(pool, gated, {
        now: () => now,
        global: new Semaphore(6),
        perHost: new HostSemaphore(2),
      }),
    );
    await firstWaveStarted;
    await Promise.all(targets.map((target) => withTransaction(pool, (tx) => requestManualCheck(tx, target.id, now))));
    const workerB = tick(
      schedulerDeps(pool, gated, {
        now: () => now,
        global: new Semaphore(6),
        perHost: new HostSemaphore(2),
      }),
    );
    releaseProbes();
    const [claimedA, claimedB] = await Promise.all([workerA, workerB]);
    expect(claimedA + claimedB).toBe(6);
    expect(peak).toBeLessThanOrEqual(2);
    for (const target of targets) {
      expect(await countChecksForTarget(pool, target.id), target.url).toBe(1);
      expect(probeCounts.get(target.url) ?? 0, target.url).toBe(1);
    }
  }, 15_000);

  it('does not claim a paused target after check-now', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const paused = await seedDueTarget(pool, now, { url: `${baseUrl}/health`, enabled: false });
    await withTransaction(pool, (tx) => requestManualCheck(tx, paused.id, now));
    const n = await tick(schedulerDeps(pool, probe, { now: () => now }));
    expect(n).toBe(0);
    expect(await countChecksForTarget(pool, paused.id)).toBe(0);
    const row = await findTargetById(pool, paused.id);
    expect(row?.enabled).toBe(false);
  });

  it('does not persist a stale owner after the lease is reclaimed', async () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const target = await seedDueTarget(pool, now, { url: `${baseUrl}/health` });
    const [first] = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 1 }));
    const staleToken = first?.probeLeaseToken;
    expect(staleToken).toEqual(expect.any(String));
    await pool.query('UPDATE targets SET probe_lease_expires_at = $2 WHERE id = $1', [
      target.id,
      new Date('2026-10-14T00:00:00.000Z'),
    ]);
    const [second] = await withTransaction(pool, (tx) => claimDueTargets(tx, { now, limit: 1 }));
    expect(second?.probeLeaseToken).not.toBe(staleToken);
    const inserted = await persistCheck(pool, target.id, now, okOutcome(), undefined, {
      token: staleToken!,
      random: () => 0,
    });
    expect(inserted).toBeUndefined();
    expect(await countChecksForTarget(pool, target.id)).toBe(0);
    const row = await findTargetById(pool, target.id);
    expect(row?.probeLeaseToken).toBe(second?.probeLeaseToken);
  });
});
