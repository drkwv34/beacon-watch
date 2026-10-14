import { afterAll, describe, expect, it } from 'vitest';
import { DomainError } from '@beacon-watch/domain';
import { buildApp } from './app.js';

describe('api scaffold', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const setup = (async () => {
    app = await buildApp({ LOG_LEVEL: 'silent' });
    app.get('/__test/conflict', async () => {
      throw new DomainError('CONFLICT', 'Slug already taken', { field: 'public_slug' });
    });
    app.get('/__test/crash', async () => {
      throw new Error('db password=hunter2 leaked in message');
    });
  })();

  afterAll(async () => {
    await setup;
    await app.close();
  });

  it('GET /healthz returns ok with a request id', async () => {
    await setup;
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('maps DomainError codes to HTTP status and a structured body', async () => {
    await setup;
    const res = await app.inject({ method: 'GET', url: '/__test/conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: { code: 'CONFLICT', message: 'Slug already taken', details: { field: 'public_slug' } },
    });
  });

  it('hides internal error messages and stack traces', async () => {
    await setup;
    const res = await app.inject({ method: 'GET', url: '/__test/crash' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('hunter2');
    expect(res.json()).toMatchObject({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  it('returns structured 404 for unknown routes', async () => {
    await setup;
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
