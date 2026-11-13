import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verify as argonVerify } from '@node-rs/argon2';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_EMAIL, DEMO_LIVE_SLUG, DEMO_PAUSED_NAME, seedEnvFilePath } from './seed.js';
import { findUserByEmail } from './repositories/users.js';
import { findTargetBySlug, findTargetByUserAndName } from './repositories/targets.js';
import { openTestPool, requireDatabaseUrl, resetDb, type DbPool } from './test/harness.js';

const execFileAsync = promisify(execFile);
const skip = !requireDatabaseUrl();
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const envPath = seedEnvFilePath();
const filePassword = 'file-password-value';
const exportPassword = 'export-password-value';

function seedChildEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  delete env.DEMO_PASSWORD;
  delete env.DEMO_TARGET_URL;
  delete env.DEMO_INTERVAL_SECONDS;
  delete env.DEMO_GRACE_THRESHOLD;
  delete env.DEMO_RECOVERY_THRESHOLD;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

async function runSeed(env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; status: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'pnpm',
      ['exec', 'tsx', '--conditions=@beacon-watch/source', 'packages/db/src/seed.ts'],
      { cwd: repoRoot, env, encoding: 'utf8', timeout: 60_000 },
    );
    return { stdout, stderr, status: 0 };
  } catch (err) {
    const failed = err as { stdout?: string; stderr?: string; status?: number | null; message?: string };
    return {
      stdout: failed.stdout ?? '',
      stderr: `${failed.stderr ?? ''}${failed.message ?? ''}`,
      status: typeof failed.status === 'number' ? failed.status : 1,
    };
  }
}

describe.skipIf(skip)('seed CLI loads root .env', () => {
  let pool: DbPool;
  let backup: string | null = null;

  beforeAll(async () => {
    pool = await openTestPool();
    try {
      backup = await readFile(envPath, 'utf8');
    } catch {
      backup = null;
    }
  });

  beforeEach(async () => {
    await resetDb(pool);
    await writeFile(
      envPath,
      [
        `DATABASE_URL=${requireDatabaseUrl()}`,
        `DEMO_PASSWORD=${filePassword}`,
        'DEMO_INTERVAL_SECONDS=30',
        'DEMO_GRACE_THRESHOLD=1',
        'DEMO_RECOVERY_THRESHOLD=1',
        '',
      ].join('\n'),
    );
  });

  afterAll(async () => {
    if (backup === null) await rm(envPath, { force: true });
    else await writeFile(envPath, backup);
    await pool.end();
  });

  it('creates demo rows from .env without exported credentials and is idempotent', async () => {
    const first = await runSeed(seedChildEnv());
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('seed ok');
    expect(`${first.stdout}${first.stderr}`).not.toContain(filePassword);

    const user = await findUserByEmail(pool, DEMO_EMAIL);
    expect(user?.email).toBe(DEMO_EMAIL);
    expect(await argonVerify(user!.passwordHash, filePassword)).toBe(true);
    const live = await findTargetBySlug(pool, DEMO_LIVE_SLUG);
    expect(live?.userId).toBe(user?.id);
    const paused = await findTargetByUserAndName(pool, user!.id, DEMO_PAUSED_NAME);
    expect(paused?.enabled).toBe(false);

    const second = await runSeed(seedChildEnv());
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('created_user=false');
    const { rows } = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM users');
    expect(Number(rows[0]?.n)).toBe(1);
    const targets = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM targets');
    expect(Number(targets.rows[0]?.n)).toBe(2);
  });

  it('lets exported DEMO_PASSWORD win and never prints it', async () => {
    const result = await runSeed(seedChildEnv({ DEMO_PASSWORD: exportPassword }));
    expect(result.status, result.stderr).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(exportPassword);
    expect(`${result.stdout}${result.stderr}`).not.toContain(filePassword);
    const user = await findUserByEmail(pool, DEMO_EMAIL);
    expect(await argonVerify(user!.passwordHash, exportPassword)).toBe(true);

    await rm(envPath, { force: true });
    const neither = await runSeed(seedChildEnv());
    expect(neither.status).not.toBe(0);
    expect(`${neither.stdout}${neither.stderr}`).toMatch(/DATABASE_URL/);
    expect(`${neither.stdout}${neither.stderr}`).not.toContain(filePassword);
    expect(`${neither.stdout}${neither.stderr}`).not.toContain(exportPassword);
  });
});
