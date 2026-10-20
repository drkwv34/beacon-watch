import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listenMockTarget } from './server.js';

describe('mock-target admin flap', () => {
  /** @type {{ server: import('node:http').Server; port: number }} */
  let listening;

  beforeAll(async () => {
    listening = await listenMockTarget(0, '127.0.0.1');
  });

  beforeEach(async () => {
    const res = await fetch(`http://127.0.0.1:${listening.port}/admin/ok`, { method: 'POST' });
    expect(res.ok).toBe(true);
  });

  afterAll(async () => {
    await new Promise((resolve) => listening.server.close(resolve));
  });

  it('flips /health to 500 then back to 200', async () => {
    const fail = await fetch(`http://127.0.0.1:${listening.port}/admin/fail`, { method: 'POST' });
    expect(fail.ok).toBe(true);
    const down = await fetch(`http://127.0.0.1:${listening.port}/health`);
    expect(down.status).toBe(500);
    expect(await down.json()).toEqual({ status: 'down' });

    const ok = await fetch(`http://127.0.0.1:${listening.port}/admin/ok`, { method: 'POST' });
    expect(ok.ok).toBe(true);
    const up = await fetch(`http://127.0.0.1:${listening.port}/health`);
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual({ status: 'ok' });
  });

  it('auto-restores after seconds=', async () => {
    const fail = await fetch(`http://127.0.0.1:${listening.port}/admin/fail?seconds=1`, { method: 'POST' });
    expect((await fail.json()).restore_after_seconds).toBe(1);
    expect((await fetch(`http://127.0.0.1:${listening.port}/health`)).status).toBe(500);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect((await fetch(`http://127.0.0.1:${listening.port}/health`)).status).toBe(200);
  });
});
