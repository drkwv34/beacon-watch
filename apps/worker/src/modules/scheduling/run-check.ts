import {
  claimDueTargets,
  insertCheck,
  lockTargetForUpdate,
  updateTargetAfterCheck,
  withTransaction,
  type DbPool,
  type TargetRow,
} from '@beacon-watch/db';
import { truncateErrorMessage, type ProbeErrorCode } from '@beacon-watch/domain';
import type { Logger } from 'pino';
import type { ProbeClient, ProbeOutcome, ProbeTarget } from '../../probe/client.js';
import type { HostSemaphore, Semaphore } from '../../pool/semaphore.js';

export interface SchedulerDeps {
  pool: DbPool;
  probe: ProbeClient;
  log: Logger;
  global: Semaphore;
  perHost: HostSemaphore;
  now: () => Date;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  pollMs: number;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid';
  }
}

function asProbeTarget(row: TargetRow): ProbeTarget {
  return {
    url: row.url,
    method: row.method,
    timeoutMs: row.timeoutMs,
    expectedStatus: row.expectedStatus,
    headers: row.headers,
    body: row.body,
  };
}

function internalFailure(err: unknown): ProbeOutcome {
  const message = err instanceof Error ? err.message : 'internal';
  return {
    success: false,
    statusCode: null,
    latencyMs: 0,
    errorCode: 'INTERNAL' as ProbeErrorCode,
    errorMessage: truncateErrorMessage(message),
  };
}

export async function runClaimedCheck(deps: SchedulerDeps, target: TargetRow): Promise<void> {
  const host = hostnameOf(target.url);
  await deps.perHost.acquire(host);
  const checkedAt = deps.now();
  const log = deps.log.child({ target_id: target.id });
  try {
    let result: ProbeOutcome;
    try {
      result = await deps.probe.probe(asProbeTarget(target));
    } catch (err) {
      log.error({ err, target_id: target.id }, 'check failed unexpectedly');
      result = internalFailure(err);
    }

    const check = await withTransaction(deps.pool, async (tx) => {
      const locked = await lockTargetForUpdate(tx, target.id);
      if (!locked) return undefined;
      const inserted = await insertCheck(tx, {
        targetId: target.id,
        checkedAt,
        success: result.success,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      await updateTargetAfterCheck(tx, target.id, {
        lastCheckedAt: checkedAt,
        lastStatus: result.success ? 'up' : 'down',
        now: checkedAt,
      });
      return inserted;
    });

    log.info(
      {
        target_id: target.id,
        check_id: check?.id,
        latency_ms: result.latencyMs,
        success: result.success,
        ...(result.errorCode ? { error_code: result.errorCode } : {}),
      },
      'check completed',
    );
  } finally {
    deps.perHost.release(host);
    deps.global.release();
  }
}

export async function tick(deps: SchedulerDeps): Promise<number> {
  const permits = deps.global.tryAcquire(deps.global.available());
  if (permits === 0) return 0;
  let claimed: TargetRow[];
  try {
    claimed = await withTransaction(deps.pool, (tx) =>
      claimDueTargets(tx, { now: deps.now(), limit: permits, random: deps.random }),
    );
  } catch (err) {
    for (let i = 0; i < permits; i += 1) deps.global.release();
    throw err;
  }
  for (let i = claimed.length; i < permits; i += 1) deps.global.release();
  await Promise.all(claimed.map((target) => runClaimedCheck(deps, target)));
  return claimed.length;
}

export async function runScheduler(deps: SchedulerDeps, signal: AbortSignal): Promise<void> {
  let delay = 1000;
  let failures = 0;
  while (!signal.aborted) {
    try {
      const n = await tick(deps);
      failures = 0;
      delay = 1000;
      if (n === 0) await deps.sleep(deps.pollMs);
    } catch (err) {
      failures += 1;
      if (failures >= 5) {
        deps.log.error({ err }, 'scheduler tick failed');
      } else {
        deps.log.warn({ err }, 'scheduler tick failed');
      }
      await deps.sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
