import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verify as argonVerify } from '@node-rs/argon2';
import { DEMO_EMAIL, DEMO_LIVE_NAME, DEMO_LIVE_SLUG, DEMO_LIVE_URL, DEMO_PAUSED_NAME, seedDemo } from './seed.js';
import { findUserByEmail } from './repositories/users.js';
import { findTargetBySlug, findTargetByUserAndName, type TargetRow } from './repositories/targets.js';
import { openTestPool, requireDatabaseUrl, resetDb, type DbPool } from './test/harness.js';

const skip = !requireDatabaseUrl();

function seedInput(password: string) {
  return {
    password,
    targetUrl: DEMO_LIVE_URL,
    intervalSeconds: 30,
    graceThreshold: 1,
    recoveryThreshold: 1,
    now: new Date('2026-10-20T00:00:00.000Z'),
  };
}

async function count(pool: DbPool, table: 'users' | 'targets'): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(rows[0]?.n ?? 0);
}

describe.skipIf(skip)('Appendix D seed', () => {
  let pool: DbPool;

  beforeAll(async () => {
    pool = await openTestPool();
  });

  beforeEach(async () => {
    await resetDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates the demo user, public monitor, and paused target', async () => {
    const result = await seedDemo(pool, seedInput('demo-password-change-me'));
    expect(result.createdUser).toBe(true);
    expect(result.createdLive).toBe(true);
    expect(result.createdPaused).toBe(true);
    expect(await count(pool, 'users')).toBe(1);
    expect(await count(pool, 'targets')).toBe(2);

    const user = await findUserByEmail(pool, DEMO_EMAIL);
    expect(user?.email).toBe(DEMO_EMAIL);
    expect(await argonVerify(user!.passwordHash, 'demo-password-change-me')).toBe(true);

    const live = await findTargetBySlug(pool, DEMO_LIVE_SLUG);
    expect(live).toMatchObject({
      userId: user!.id,
      name: DEMO_LIVE_NAME,
      url: DEMO_LIVE_URL,
      intervalSeconds: 30,
      graceThreshold: 1,
      recoveryThreshold: 1,
      enabled: true,
      isPublic: true,
      publicSlug: DEMO_LIVE_SLUG,
    } satisfies Partial<TargetRow>);

    const paused = await findTargetByUserAndName(pool, user!.id, DEMO_PAUSED_NAME);
    expect(paused?.enabled).toBe(false);
    expect(paused?.isPublic).toBe(false);
    expect(paused?.graceThreshold).toBe(2);
  });

  it('is idempotent and refreshes the password hash', async () => {
    const first = await seedDemo(pool, seedInput('demo-password-change-me'));
    const second = await seedDemo(pool, seedInput('demo-password-change-me'));
    expect(second.createdUser).toBe(false);
    expect(second.createdLive).toBe(false);
    expect(second.createdPaused).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(second.liveTargetId).toBe(first.liveTargetId);
    expect(second.pausedTargetId).toBe(first.pausedTargetId);
    expect(await count(pool, 'users')).toBe(1);
    expect(await count(pool, 'targets')).toBe(2);

    const rotated = await seedDemo(pool, seedInput('new-demo-password'));
    expect(rotated.userId).toBe(first.userId);
    expect(await count(pool, 'users')).toBe(1);
    expect(await count(pool, 'targets')).toBe(2);
    const user = await findUserByEmail(pool, DEMO_EMAIL);
    expect(await argonVerify(user!.passwordHash, 'new-demo-password')).toBe(true);
  });
});
