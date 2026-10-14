import { describe, expect, it } from 'vitest';
import { cookieBase } from './cookies.js';

describe('session cookie flags', () => {
  const expires = new Date('2026-10-21T00:00:00.000Z');

  it('is HttpOnly SameSite=Lax and not Secure outside production', () => {
    const opts = cookieBase({ NODE_ENV: 'development' }, true, expires);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(false);
    expect(opts.path).toBe('/');
  });

  it('sets Secure in production', () => {
    const opts = cookieBase({ NODE_ENV: 'production' }, true, expires);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(true);
  });
});
