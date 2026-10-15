import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGE_MAX,
  PROBE_ERROR_CODES,
  connectTimeoutMs,
  isProbeErrorCode,
  truncateErrorMessage,
} from './probe.js';

describe('probe error codes', () => {
  it('is a closed set with a type guard', () => {
    expect([...PROBE_ERROR_CODES]).toEqual([
      'TIMEOUT',
      'DNS',
      'TLS',
      'CONNECT',
      'UNEXPECTED_STATUS',
      'SSRF_BLOCKED',
      'REDIRECT_LIMIT',
      'INTERNAL',
    ]);
    expect(isProbeErrorCode('TIMEOUT')).toBe(true);
    expect(isProbeErrorCode('BODY_TOO_LARGE')).toBe(false);
    expect(isProbeErrorCode('VALIDATION_FAILED')).toBe(false);
  });
});

describe('truncateErrorMessage', () => {
  it('returns null for empty input', () => {
    expect(truncateErrorMessage(null)).toBeNull();
    expect(truncateErrorMessage(undefined)).toBeNull();
    expect(truncateErrorMessage('')).toBeNull();
  });

  it('keeps messages at or under 500 characters', () => {
    expect(truncateErrorMessage('timeout')).toBe('timeout');
    expect(truncateErrorMessage('x'.repeat(ERROR_MESSAGE_MAX))).toHaveLength(500);
  });

  it('truncates to 500 characters', () => {
    const truncated = truncateErrorMessage('x'.repeat(ERROR_MESSAGE_MAX + 25));
    expect(truncated).toHaveLength(500);
  });
});

describe('connectTimeoutMs', () => {
  it('caps at 2000 and never exceeds the total timeout', () => {
    expect(connectTimeoutMs(500)).toBe(500);
    expect(connectTimeoutMs(2000)).toBe(2000);
    expect(connectTimeoutMs(5000)).toBe(2000);
  });
});
