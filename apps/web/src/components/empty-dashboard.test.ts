import { describe, expect, it } from 'vitest';
import { PUBLIC_STATUS_NOTICE, selectPublicStatusNotice } from '../lib/status-labels';

const DASHBOARD_EMPTY_CTA = 'Add your first monitor.';

describe('empty-state selection', () => {
  it('uses the dashboard empty copy for zero targets', () => {
    expect(DASHBOARD_EMPTY_CTA).toBe('Add your first monitor.');
  });

  it('selects public-page copy for starting, paused, and never-succeeded', () => {
    expect(selectPublicStatusNotice({ status: 'unknown', check_count: 0, ever_succeeded: false })).toBe('starting');
    expect(PUBLIC_STATUS_NOTICE.starting).toBe('Monitoring starting…');
    expect(selectPublicStatusNotice({ status: 'paused', check_count: 3, ever_succeeded: true })).toBe('paused');
    expect(PUBLIC_STATUS_NOTICE.paused).toBe('Monitoring is paused');
    expect(selectPublicStatusNotice({ status: 'down', check_count: 3, ever_succeeded: false })).toBe('never_succeeded');
    expect(PUBLIC_STATUS_NOTICE.never_succeeded).toBe('No successful checks yet.');
    expect(selectPublicStatusNotice({ status: 'up', check_count: 4, ever_succeeded: true })).toBeNull();
  });
});
