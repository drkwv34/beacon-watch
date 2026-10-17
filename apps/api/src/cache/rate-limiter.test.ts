import { describe, expect, it } from 'vitest';
import { rateLimitAllowed, rateLimitRemaining, rateLimitRetryAfterSeconds } from '@beacon-watch/domain';

describe('public rate limiter window math', () => {
  it('allows the 60th request and rejects the 61st', () => {
    expect(rateLimitAllowed(60, 60)).toBe(true);
    expect(rateLimitAllowed(61, 60)).toBe(false);
    expect(rateLimitRemaining(60, 60)).toBe(0);
    expect(rateLimitRemaining(60, 61)).toBe(0);
    expect(rateLimitRetryAfterSeconds(17)).toBe(17);
  });
});
