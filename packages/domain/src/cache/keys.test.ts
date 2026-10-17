import { describe, expect, it } from 'vitest';
import {
  CACHE_VALUE_VERSION,
  STATUS_PAGE_TTL_SECONDS,
  latestStatusTtlSeconds,
  publicRateLimitKey,
  statusPageKey,
  targetLatestKey,
} from './keys.js';

describe('cache keys', () => {
  it('builds versioned key shapes without call-site concatenation', () => {
    expect(targetLatestKey('11111111-1111-4111-8111-111111111111')).toBe(
      'target:11111111-1111-4111-8111-111111111111:latest',
    );
    expect(statusPageKey('portfolio-demo')).toBe('statuspage:portfolio-demo');
    expect(publicRateLimitKey('203.0.113.10', 1_700_000_000)).toBe('ratelimit:public:203.0.113.10:1700000000');
    expect(CACHE_VALUE_VERSION).toBe(1);
    expect(STATUS_PAGE_TTL_SECONDS).toBe(15);
  });
});

describe('latestStatusTtlSeconds', () => {
  it('uses a 120s floor for a 60s interval', () => {
    expect(latestStatusTtlSeconds(60)).toBe(120);
  });

  it('uses 2 × interval when that is larger than 120s', () => {
    expect(latestStatusTtlSeconds(90)).toBe(180);
  });
});
