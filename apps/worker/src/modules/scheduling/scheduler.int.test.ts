import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  countChecksForTarget,
  findOpenIncident,
  findTargetById,
  listChecksForTarget,
  listIncidentsForTarget,
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
});
