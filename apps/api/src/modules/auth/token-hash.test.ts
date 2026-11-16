import { describe, expect, it } from 'vitest';
import { hashApiToken, hashSessionToken, readBearerToken } from './service.js';

const SECRET = 'replace-me-with-at-least-32-random-characters';

describe('token hashing', () => {
  it('uses a distinct HMAC context from session tokens', () => {
    const raw = 'bw_abcd1234_secret';
    expect(hashApiToken(SECRET, raw)).not.toBe(hashSessionToken(SECRET, raw));
    expect(hashApiToken(SECRET, raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('parses a Bearer header and rejects empty or extra parts', () => {
    expect(readBearerToken('Bearer abc')).toBe('abc');
    expect(readBearerToken('bearer abc')).toBe('abc');
    expect(readBearerToken('Bearer')).toBeUndefined();
    expect(readBearerToken('Basic abc')).toBeUndefined();
    expect(readBearerToken(undefined)).toBeUndefined();
  });
});
