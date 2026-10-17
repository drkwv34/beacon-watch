import { describe, expect, it } from 'vitest';
import {
  rateLimitAllowed,
  rateLimitRemaining,
  rateLimitRetryAfterSeconds,
  rateLimitWindowStartSeconds,
} from './rate-limit.js';

describe('rate-limit window math', () => {
  it('aligns now to the start of a 60s window', () => {
    const now = new Date('2026-10-16T12:00:30.500Z');
    expect(rateLimitWindowStartSeconds(now)).toBe(Math.floor(Date.parse('2026-10-16T12:00:00.000Z') / 1000));
    expect(rateLimitWindowStartSeconds(now, 60)).toBe(1_792_152_000);
  });

  it('counts remaining and 429 after the limit is exceeded', () => {
    expect(rateLimitRemaining(60, 1)).toBe(59);
    expect(rateLimitRemaining(60, 60)).toBe(0);
    expect(rateLimitRemaining(60, 61)).toBe(0);
    expect(rateLimitAllowed(60, 60)).toBe(true);
    expect(rateLimitAllowed(61, 60)).toBe(false);
  });

  it('uses Redis TTL for Retry-After and falls back to the window length', () => {
    expect(rateLimitRetryAfterSeconds(42)).toBe(42);
    expect(rateLimitRetryAfterSeconds(0)).toBe(60);
    expect(rateLimitRetryAfterSeconds(-1)).toBe(60);
  });
});
