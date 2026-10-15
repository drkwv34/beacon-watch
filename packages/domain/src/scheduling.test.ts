import { describe, expect, it } from 'vitest';
import { computeNextCheckAt } from './scheduling.js';

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
