import { describe, expect, it } from 'vitest';
import { computeNextCheckAt, computeProbeLeaseExpiry, probeLeaseIsActive } from './scheduling.js';

describe('computeNextCheckAt', () => {
  const now = new Date('2026-10-15T00:00:00.000Z');

  it('adds only the interval when random is 0', () => {
    expect(computeNextCheckAt(now, 60, () => 0).toISOString()).toBe('2026-10-15T00:01:00.000Z');
  });

  it('adds 5% jitter when random is 0.5', () => {
    expect(computeNextCheckAt(now, 60, () => 0.5).toISOString()).toBe('2026-10-15T00:01:03.000Z');
  });

  it('adds 10% jitter when random is 1', () => {
    expect(computeNextCheckAt(now, 60, () => 1).toISOString()).toBe('2026-10-15T00:01:06.000Z');
  });
});

describe('computeProbeLeaseExpiry', () => {
  const now = new Date('2026-10-15T00:00:00.000Z');

  it('adds timeout plus the 30s floor when 3× timeout is smaller', () => {
    expect(computeProbeLeaseExpiry(now, 4_000).toISOString()).toBe('2026-10-15T00:00:34.000Z');
  });

  it('uses 3× timeout as grace when that exceeds 30s', () => {
    expect(computeProbeLeaseExpiry(now, 12_000).toISOString()).toBe('2026-10-15T00:00:48.000Z');
  });
});

describe('probeLeaseIsActive', () => {
  const now = new Date('2026-10-15T00:00:00.000Z');

  it('is false when there is no expiry', () => {
    expect(probeLeaseIsActive(null, now)).toBe(false);
  });

  it('is false when the expiry is now or earlier', () => {
    expect(probeLeaseIsActive(now, now)).toBe(false);
    expect(probeLeaseIsActive(new Date('2026-10-14T23:59:59.000Z'), now)).toBe(false);
  });

  it('is true when the expiry is still in the future', () => {
    expect(probeLeaseIsActive(new Date('2026-10-15T00:00:01.000Z'), now)).toBe(true);
  });
});
