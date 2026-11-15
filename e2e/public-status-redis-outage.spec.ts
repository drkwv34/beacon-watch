import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = process.env.API_HOST_URL ?? 'http://127.0.0.1:4000';

function compose(args: string[]): string {
  return execFileSync('docker', ['compose', '--env-file', '.env.example', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

function redisPing(): boolean {
  try {
    const out = execFileSync(
      'docker',
      ['compose', '--env-file', '.env.example', 'exec', '-T', 'redis', 'redis-cli', 'ping'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    return out.trim() === 'PONG';
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`timed out waiting for ${label}`);
}

test.describe.configure({ mode: 'serial' });

test('HTML status stays up when Redis is stopped while JSON fails closed', async ({ request }) => {
  test.setTimeout(120_000);

  try {
    compose(['stop', 'redis']);
    await waitFor(() => !redisPing(), 20_000, 'redis to stop');

    const html = await request.get('/s/demo', { maxRedirects: 0 });
    expect(html.status()).toBe(200);
    const body = await html.text();
    expect(body).toMatch(/mock-target/);
    expect(body).toMatch(/\b(Up|Down|Paused|Unknown)\b/);
    expect(body).toMatch(/Recent incidents/);
    expect(body).not.toMatch(/Status temporarily unavailable/);

    const json = await request.get(`${apiBase}/api/public/v1/status/demo`, { maxRedirects: 0 });
    expect(json.status()).toBe(503);
    const payload = (await json.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe('DEPENDENCY_UNAVAILABLE');
  } finally {
    compose(['start', 'redis']);
    await waitFor(() => redisPing(), 30_000, 'redis to become healthy');
    await waitFor(
      async () => {
        try {
          const res = await request.get(`${apiBase}/api/public/v1/status/demo`, { maxRedirects: 0 });
          return res.status() === 200;
        } catch {
          return false;
        }
      },
      30_000,
      'public JSON to recover after Redis start',
    );
  }
});
