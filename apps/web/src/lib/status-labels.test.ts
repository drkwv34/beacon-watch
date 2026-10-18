import { describe, expect, it } from 'vitest';
import { PUBLIC_STATUS_NOTICE, STATUS_BADGE_LABELS, selectPublicStatusNotice } from './status-labels.js';

describe('StatusBadge labels', () => {
  it('maps every display status to a text label so color is never the only indicator', () => {
    expect(STATUS_BADGE_LABELS).toEqual({
      up: 'Up',
      down: 'Down',
      unknown: 'Unknown',
      paused: 'Paused',
    });
  });
});

describe('selectPublicStatusNotice', () => {
  it('returns null on the happy path', () => {
    expect(selectPublicStatusNotice({ status: 'up', check_count: 4, ever_succeeded: true })).toBeNull();
    expect(PUBLIC_STATUS_NOTICE.starting).toBe('Monitoring starting…');
  });
});
