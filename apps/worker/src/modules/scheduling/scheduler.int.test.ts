import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { countChecksForTarget, listChecksForTarget, type DbPool } from '@beacon-watch/db';
import { tick } from './run-check.js';
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
});
