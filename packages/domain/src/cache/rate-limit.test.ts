import { describe, expect, it } from 'vitest';
import {
  rateLimitAllowed,
  rateLimitRemaining,
  rateLimitRetryAfterSeconds,
  rateLimitWindowCutoffMs,
} from './rate-limit.js';

describe('rate-limit sliding window math', () => {
  it('cuts off admissions older than the window', () => {
    expect(rateLimitWindowCutoffMs(1_700_000_060_000, 60_000)).toBe(1_700_000_000_000);
  });

  it('counts remaining and 429 after the limit is exceeded', () => {
    expect(rateLimitRemaining(60, 1)).toBe(59);
    expect(rateLimitRemaining(60, 60)).toBe(0);
    expect(rateLimitRemaining(60, 61)).toBe(0);
    expect(rateLimitAllowed(60, 60)).toBe(true);
    expect(rateLimitAllowed(61, 60)).toBe(false);
  });

  it('ceils Retry-After to whole seconds with a minimum of 1', () => {
    const windowMs = 60_000;
    const oldest = 1_700_000_000_000;
    expect(rateLimitRetryAfterSeconds(oldest, oldest + 43_000, windowMs)).toBe(17);
    expect(rateLimitRetryAfterSeconds(oldest, oldest + 42_400, windowMs)).toBe(18);
    expect(rateLimitRetryAfterSeconds(oldest, oldest + windowMs - 400, windowMs)).toBe(1);
    expect(rateLimitRetryAfterSeconds(oldest, oldest + windowMs, windowMs)).toBe(1);
  });
});
