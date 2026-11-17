import { describe, expect, it } from 'vitest';
import { interpretMeStatus } from './me-status';

describe('interpretMeStatus', () => {
  it('treats 200 as authenticated, 401 as unauthenticated, and outages as unavailable', () => {
    expect(interpretMeStatus(200)).toBe('authenticated');
    expect(interpretMeStatus(401)).toBe('unauthenticated');
    expect(interpretMeStatus(503)).toBe('unavailable');
    expect(interpretMeStatus(500)).toBe('unavailable');
  });
});
