import { describe, expect, it } from 'vitest';
import { formatDuration, formatLatency, formatUptime, relativeTimeLabel } from './format.js';

describe('format helpers', () => {
  it('formats latency and uptime placeholders', () => {
    expect(formatLatency(null)).toBe('—');
    expect(formatLatency(42)).toBe('42 ms');
    expect(formatUptime(null)).toBe('—');
    expect(formatUptime(0.997)).toBe('99.70%');
  });

  it('formats durations', () => {
    expect(formatDuration(9)).toBe('9s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats relative last-checked time', () => {
    const now = Date.parse('2026-10-17T12:00:00.000Z');
    expect(relativeTimeLabel(null, now)).toBe('Never');
    expect(relativeTimeLabel('2026-10-17T11:59:50.000Z', now)).toBe('10s ago');
    expect(relativeTimeLabel('2026-10-17T11:00:00.000Z', now)).toBe('1h ago');
  });
});
