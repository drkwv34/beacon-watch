import { describe, expect, it } from 'vitest';
import { asCheckId, asTargetId } from '@beacon-watch/domain';
import { mapCheck, type CheckRow } from './checks.js';

describe('mapCheck', () => {
  it('maps snake_case rows to camelCase', () => {
    const checkedAt = new Date('2026-10-15T00:00:00.000Z');
    const row: CheckRow = mapCheck({
      id: '33333333-3333-4333-8333-333333333333',
      target_id: '11111111-1111-4111-8111-111111111111',
      checked_at: checkedAt,
      success: false,
      status_code: 503,
      latency_ms: 12,
      error_code: 'UNEXPECTED_STATUS',
      error_message: 'status 503',
    });
    expect(row).toEqual({
      id: asCheckId('33333333-3333-4333-8333-333333333333'),
      targetId: asTargetId('11111111-1111-4111-8111-111111111111'),
      checkedAt,
      success: false,
      statusCode: 503,
      latencyMs: 12,
      errorCode: 'UNEXPECTED_STATUS',
      errorMessage: 'status 503',
    });
  });
});
