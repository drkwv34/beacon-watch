import { describe, expect, it } from 'vitest';
import { loadStatusDbConfig, loadWebConfig } from './config.js';

describe('web config', () => {
  it('defaults API_BASE_URL for dashboard HTTP', () => {
    expect(loadWebConfig({}).API_BASE_URL).toBe('http://localhost:4000');
    expect(loadWebConfig({ API_BASE_URL: 'http://api:4000' }).API_BASE_URL).toBe('http://api:4000');
  });

  it('requires DATABASE_URL for the status reader and ignores NEXT_PUBLIC_DATABASE_URL', () => {
    expect(() => loadStatusDbConfig({})).toThrow('Invalid web status database configuration: DATABASE_URL');
    expect(() =>
      loadStatusDbConfig({ NEXT_PUBLIC_DATABASE_URL: 'postgresql://beacon:beacon@localhost:5432/beacon' }),
    ).toThrow('Invalid web status database configuration: DATABASE_URL');
    expect(
      loadStatusDbConfig({
        DATABASE_URL: 'postgresql://beacon:beacon@localhost:5432/beacon',
        NEXT_PUBLIC_DATABASE_URL: 'postgresql://evil',
      }).DATABASE_URL,
    ).toBe('postgresql://beacon:beacon@localhost:5432/beacon');
  });
});
