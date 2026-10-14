import { describe, expect, it } from 'vitest';
import { csrfMatches } from './service.js';

describe('csrfMatches', () => {
  it('rejects missing or mismatched tokens', () => {
    expect(csrfMatches(undefined, 'abc')).toBe(false);
    expect(csrfMatches('abc', undefined)).toBe(false);
    expect(csrfMatches('abc', 'abd')).toBe(false);
  });

  it('accepts equal cookie and header values', () => {
    expect(csrfMatches('token-one', 'token-one')).toBe(true);
  });
});
