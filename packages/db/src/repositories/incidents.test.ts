import { describe, expect, it } from 'vitest';
import { asCheckId, asIncidentId, asTargetId } from '@beacon-watch/domain';
import { mapIncident, toPublicIncident, toPublicRecentIncident, type IncidentRow } from './incidents.js';

describe('mapIncident', () => {
  it('maps snake_case rows to camelCase', () => {
    const openedAt = new Date('2026-10-15T00:00:00.000Z');
    const row: IncidentRow = mapIncident({
      id: '44444444-4444-4444-8444-444444444444',
      target_id: '11111111-1111-4111-8111-111111111111',
      status: 'open',
      opened_at: openedAt,
      resolved_at: null,
      trigger_check_id: '33333333-3333-4333-8333-333333333333',
      resolve_check_id: null,
    });
    expect(row).toEqual({
      id: asIncidentId('44444444-4444-4444-8444-444444444444'),
      targetId: asTargetId('11111111-1111-4111-8111-111111111111'),
      status: 'open',
      openedAt,
      resolvedAt: null,
      triggerCheckId: asCheckId('33333333-3333-4333-8333-333333333333'),
      resolveCheckId: null,
    });
  });
});

describe('toPublicIncident', () => {
  const openedAt = new Date('2026-10-15T00:00:00.000Z');
  const base: IncidentRow = {
    id: asIncidentId('44444444-4444-4444-8444-444444444444'),
    targetId: asTargetId('11111111-1111-4111-8111-111111111111'),
    status: 'open',
    openedAt,
    resolvedAt: null,
    triggerCheckId: asCheckId('33333333-3333-4333-8333-333333333333'),
    resolveCheckId: null,
  };

  it('uses now minus opened_at for open incidents', () => {
    const now = new Date('2026-10-15T00:01:30.000Z');
    expect(toPublicIncident(base, now)).toEqual({
      id: base.id,
      status: 'open',
      opened_at: '2026-10-15T00:00:00.000Z',
      resolved_at: null,
      trigger_check_id: base.triggerCheckId,
      duration_seconds: 90,
    });
  });

  it('uses resolved_at minus opened_at for resolved incidents', () => {
    const resolved = {
      ...base,
      status: 'resolved' as const,
      resolvedAt: new Date('2026-10-15T00:00:10.000Z'),
      resolveCheckId: asCheckId('55555555-5555-4555-8555-555555555555'),
    };
    const now = new Date('2026-10-15T01:00:00.000Z');
    expect(toPublicIncident(resolved, now)).toMatchObject({
      status: 'resolved',
      resolved_at: '2026-10-15T00:00:10.000Z',
      duration_seconds: 10,
    });
  });

  it('omits ids on the public recent-incident shape', () => {
    const now = new Date('2026-10-15T00:01:30.000Z');
    const json = toPublicRecentIncident(base, now);
    expect(json).toEqual({
      opened_at: '2026-10-15T00:00:00.000Z',
      resolved_at: null,
      duration_seconds: 90,
      status: 'open',
    });
    expect(json).not.toHaveProperty('id');
    expect(json).not.toHaveProperty('trigger_check_id');
  });
});
