import { describe, expect, it } from 'vitest';
import {
  PUBLIC_STATUS_NOTICE,
  publicDisplayStatus,
  selectPublicStatusNotice,
  unwrapCacheValue,
  uptime24h,
  wrapCacheValue,
} from './status.js';

describe('uptime24h', () => {
  it('returns null when there are no checks', () => {
    expect(uptime24h(0, 0)).toBeNull();
  });

  it('returns the share of successful checks', () => {
    expect(uptime24h(997, 1000)).toBe(0.997);
    expect(uptime24h(0, 4)).toBe(0);
    expect(uptime24h(4, 4)).toBe(1);
  });
});

describe('versioned cache values', () => {
  it('wraps and unwraps v=1 payloads', () => {
    const payload = { name: 'Portfolio demo API', status: 'up' as const };
    const wrapped = wrapCacheValue(payload);
    expect(wrapped).toEqual({ v: 1, name: 'Portfolio demo API', status: 'up' });
    expect(unwrapCacheValue<typeof payload>(wrapped)).toEqual(payload);
  });

  it('treats a missing or unknown version as a miss', () => {
    expect(unwrapCacheValue({ name: 'x' })).toBeUndefined();
    expect(unwrapCacheValue({ v: 2, name: 'x' })).toBeUndefined();
    expect(unwrapCacheValue(null)).toBeUndefined();
  });
});

describe('publicDisplayStatus', () => {
  it('derives paused from enabled=false', () => {
    expect(publicDisplayStatus(false, 'up')).toBe('paused');
    expect(publicDisplayStatus(true, 'down')).toBe('down');
  });
});

describe('selectPublicStatusNotice', () => {
  it('selects paused even when there are no checks', () => {
    expect(selectPublicStatusNotice({ status: 'paused', check_count: 0, ever_succeeded: false })).toBe('paused');
    expect(PUBLIC_STATUS_NOTICE.paused).toBe('Monitoring is paused');
  });

  it('selects starting when there are zero checks', () => {
    expect(selectPublicStatusNotice({ status: 'unknown', check_count: 0, ever_succeeded: false })).toBe('starting');
    expect(PUBLIC_STATUS_NOTICE.starting).toBe('Monitoring starting…');
  });

  it('selects never_succeeded after only failed checks', () => {
    expect(selectPublicStatusNotice({ status: 'down', check_count: 2, ever_succeeded: false })).toBe('never_succeeded');
    expect(PUBLIC_STATUS_NOTICE.never_succeeded).toBe('No successful checks yet.');
  });

  it('returns null on the happy path', () => {
    expect(selectPublicStatusNotice({ status: 'up', check_count: 4, ever_succeeded: true })).toBeNull();
  });
});
