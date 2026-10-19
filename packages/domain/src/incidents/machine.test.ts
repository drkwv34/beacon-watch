import { describe, expect, it } from 'vitest';
import { applyCheckResult, isIncidentStatus, type Counters, type Thresholds } from './machine.js';

const grace2: Thresholds = { grace: 2, recovery: 2 };
const zero: Counters = { consecutiveFailures: 0, consecutiveSuccesses: 0, hasOpenIncident: false };

describe('isIncidentStatus', () => {
  it('accepts the closed set', () => {
    expect(isIncidentStatus('open')).toBe(true);
    expect(isIncidentStatus('resolved')).toBe(true);
    expect(isIncidentStatus('closed')).toBe(false);
  });
});

describe('applyCheckResult Appendix B', () => {
  it('replays the grace=2 recovery=2 worked example row by row', () => {
    const steps: Array<{ success: boolean; action: 'none' | 'open' | 'resolve'; counters: Counters }> = [
      {
        success: false,
        action: 'none',
        counters: { consecutiveFailures: 1, consecutiveSuccesses: 0, hasOpenIncident: false },
      },
      {
        success: false,
        action: 'open',
        counters: { consecutiveFailures: 2, consecutiveSuccesses: 0, hasOpenIncident: true },
      },
      {
        success: true,
        action: 'none',
        counters: { consecutiveFailures: 0, consecutiveSuccesses: 1, hasOpenIncident: true },
      },
      {
        success: false,
        action: 'none',
        counters: { consecutiveFailures: 1, consecutiveSuccesses: 0, hasOpenIncident: true },
      },
      {
        success: true,
        action: 'none',
        counters: { consecutiveFailures: 0, consecutiveSuccesses: 1, hasOpenIncident: true },
      },
      {
        success: true,
        action: 'resolve',
        counters: { consecutiveFailures: 0, consecutiveSuccesses: 2, hasOpenIncident: false },
      },
    ];

    let prev = zero;
    for (const step of steps) {
      const next = applyCheckResult(prev, step.success, grace2);
      expect(next).toEqual({ action: step.action, counters: step.counters });
      prev = next.counters;
    }
  });

  it('does not open until grace=3 consecutive failures', () => {
    const t: Thresholds = { grace: 3, recovery: 2 };
    const first = applyCheckResult(zero, false, t);
    expect(first).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 1, consecutiveSuccesses: 0, hasOpenIncident: false },
    });
    const second = applyCheckResult(first.counters, false, t);
    expect(second).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 2, consecutiveSuccesses: 0, hasOpenIncident: false },
    });
    const third = applyCheckResult(second.counters, false, t);
    expect(third).toEqual({
      action: 'open',
      counters: { consecutiveFailures: 3, consecutiveSuccesses: 0, hasOpenIncident: true },
    });
  });

  it('resets consecutive_failures on success', () => {
    const afterFail = applyCheckResult(zero, false, grace2);
    expect(afterFail.counters.consecutiveFailures).toBe(1);
    const afterSuccess = applyCheckResult(afterFail.counters, true, grace2);
    expect(afterSuccess).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 0, consecutiveSuccesses: 1, hasOpenIncident: false },
    });
  });

  it('resets consecutive_successes on failure while an incident is open', () => {
    const open = applyCheckResult(applyCheckResult(zero, false, grace2).counters, false, grace2);
    expect(open.action).toBe('open');
    const recovering = applyCheckResult(open.counters, true, grace2);
    expect(recovering.counters.consecutiveSuccesses).toBe(1);
    const flake = applyCheckResult(recovering.counters, false, grace2);
    expect(flake).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 1, consecutiveSuccesses: 0, hasOpenIncident: true },
    });
  });
});

describe('single-failure no-noise FR-INC-001', () => {
  it('does not open on fail then success', () => {
    const afterFail = applyCheckResult(zero, false, grace2);
    expect(afterFail).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 1, consecutiveSuccesses: 0, hasOpenIncident: false },
    });
    const afterSuccess = applyCheckResult(afterFail.counters, true, grace2);
    expect(afterSuccess).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 0, consecutiveSuccesses: 1, hasOpenIncident: false },
    });
  });

  it('opens on fail then fail', () => {
    const first = applyCheckResult(zero, false, grace2);
    expect(first.action).toBe('none');
    expect(first.counters.hasOpenIncident).toBe(false);
    const second = applyCheckResult(first.counters, false, grace2);
    expect(second).toEqual({
      action: 'open',
      counters: { consecutiveFailures: 2, consecutiveSuccesses: 0, hasOpenIncident: true },
    });
  });
});

describe('resolve on consecutive successes FR-INC-002', () => {
  it('resolves after two successes when recovery is 2', () => {
    const opened = applyCheckResult(applyCheckResult(zero, false, grace2).counters, false, grace2);
    expect(opened.action).toBe('open');
    const firstOk = applyCheckResult(opened.counters, true, grace2);
    expect(firstOk).toEqual({
      action: 'none',
      counters: { consecutiveFailures: 0, consecutiveSuccesses: 1, hasOpenIncident: true },
    });
    const secondOk = applyCheckResult(firstOk.counters, true, grace2);
    expect(secondOk).toEqual({
      action: 'resolve',
      counters: { consecutiveFailures: 0, consecutiveSuccesses: 2, hasOpenIncident: false },
    });
  });
});
