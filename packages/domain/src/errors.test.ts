import { describe, expect, it } from 'vitest';
import { DomainError, isDomainError, isTargetStatus } from './index.js';

describe('DomainError', () => {
  it('carries a stable code and optional details', () => {
    const err = new DomainError('CONFLICT', 'slug taken', { field: 'public_slug' });
    expect(isDomainError(err)).toBe(true);
    expect(err.code).toBe('CONFLICT');
    expect(err.details).toEqual({ field: 'public_slug' });
  });

  it('does not treat plain errors as domain errors', () => {
    expect(isDomainError(new Error('boom'))).toBe(false);
  });
});

describe('isTargetStatus', () => {
  it('accepts only persisted statuses', () => {
    expect(isTargetStatus('up')).toBe(true);
    expect(isTargetStatus('paused')).toBe(false);
  });
});
