import { lookup } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { DomainError } from '@beacon-watch/domain';
import { createPool, type DbClient, type DbPool } from './client.js';
import { migrate } from './migrate.js';
import { insertUser, findUserByEmail, updateUserPasswordHash } from './repositories/users.js';
import {
  findTargetBySlug,
  findTargetByUserAndName,
  insertTarget,
  updateTarget,
  type TargetRow,
} from './repositories/targets.js';
import { withTransaction } from './transaction.js';

export const DEMO_EMAIL = 'demo@beacon.local';
export const DEMO_LIVE_NAME = 'mock-target';
export const DEMO_LIVE_SLUG = 'demo';
export const DEMO_LIVE_URL = 'http://mock-target:8080/health';
export const DEMO_PAUSED_NAME = 'Paused example';
export const DEMO_INTERVAL_SECONDS = 30;

const ARGON2 = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface SeedDemoInput {
  password: string;
  targetUrl: string;
  intervalSeconds: number;
  graceThreshold: number;
  recoveryThreshold: number;
  now: Date;
}

export interface SeedDemoResult {
  userId: string;
  liveTargetId: string;
  pausedTargetId: string;
  createdUser: boolean;
  createdLive: boolean;
  createdPaused: boolean;
}

export interface SeedEnv {
  databaseUrl: string;
  password: string;
  targetUrl: string;
  intervalSeconds: number;
  graceThreshold: number;
  recoveryThreshold: number;
}

function invalid(keys: string[]): never {
  throw new Error(`Invalid seed configuration: ${keys.join(', ')}`);
}

export function parseSeedEnv(env: NodeJS.ProcessEnv): SeedEnv {
  const keys: string[] = [];
  const databaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) keys.push('DATABASE_URL');
  const password = env.DEMO_PASSWORD ?? '';
  if (password.length < 8 || password.length > 1024) keys.push('DEMO_PASSWORD');
  const targetUrl = (env.DEMO_TARGET_URL?.trim() || DEMO_LIVE_URL).trim();
  const intervalSeconds = Number(env.DEMO_INTERVAL_SECONDS ?? DEMO_INTERVAL_SECONDS);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 3600) {
    keys.push('DEMO_INTERVAL_SECONDS');
  }
  const graceThreshold = Number(env.DEMO_GRACE_THRESHOLD ?? 1);
  if (!Number.isInteger(graceThreshold) || graceThreshold < 1 || graceThreshold > 10) {
    keys.push('DEMO_GRACE_THRESHOLD');
  }
  const recoveryThreshold = Number(env.DEMO_RECOVERY_THRESHOLD ?? 1);
  if (!Number.isInteger(recoveryThreshold) || recoveryThreshold < 1 || recoveryThreshold > 10) {
    keys.push('DEMO_RECOVERY_THRESHOLD');
  }
  if (keys.length > 0) invalid(keys);
  return { databaseUrl, password, targetUrl, intervalSeconds, graceThreshold, recoveryThreshold };
}

/** When seed runs on the host, Compose's `db` hostname is not resolvable. */
export function rewriteComposeDatabaseUrl(url: string, dbHostResolves: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname === 'db' && !dbHostResolves) {
    parsed.hostname = '127.0.0.1';
  }
  return parsed.toString();
}

async function dbHostResolves(): Promise<boolean> {
  try {
    await lookup('db');
    return true;
  } catch {
    return false;
  }
}

async function upsertLiveTarget(
  tx: DbClient,
  input: SeedDemoInput & { userId: TargetRow['userId'] },
): Promise<{ row: TargetRow; created: boolean }> {
  const existing = await findTargetBySlug(tx, DEMO_LIVE_SLUG);
  if (existing && existing.userId !== input.userId) {
    throw new DomainError('CONFLICT', 'Slug already taken', { field: 'public_slug' });
  }
  if (existing) {
    const row = await updateTarget(tx, existing.id, {
      name: DEMO_LIVE_NAME,
      url: input.targetUrl,
      method: 'GET',
      intervalSeconds: input.intervalSeconds,
      timeoutMs: 5000,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: input.graceThreshold,
      recoveryThreshold: input.recoveryThreshold,
      enabled: true,
      isPublic: true,
      publicSlug: DEMO_LIVE_SLUG,
      now: input.now,
    });
    return { row, created: false };
  }
  const row = await insertTarget(tx, {
    userId: input.userId,
    name: DEMO_LIVE_NAME,
    url: input.targetUrl,
    method: 'GET',
    intervalSeconds: input.intervalSeconds,
    timeoutMs: 5000,
    expectedStatus: 200,
    headers: null,
    body: null,
    graceThreshold: input.graceThreshold,
    recoveryThreshold: input.recoveryThreshold,
    enabled: true,
    isPublic: true,
    publicSlug: DEMO_LIVE_SLUG,
    now: input.now,
  });
  return { row, created: true };
}

async function upsertPausedTarget(
  tx: DbClient,
  input: SeedDemoInput & { userId: TargetRow['userId'] },
): Promise<{ row: TargetRow; created: boolean }> {
  const existing = await findTargetByUserAndName(tx, input.userId, DEMO_PAUSED_NAME);
  if (existing) {
    const row = await updateTarget(tx, existing.id, {
      name: DEMO_PAUSED_NAME,
      url: input.targetUrl,
      method: 'GET',
      intervalSeconds: input.intervalSeconds,
      timeoutMs: 5000,
      expectedStatus: 200,
      headers: null,
      body: null,
      graceThreshold: 2,
      recoveryThreshold: 2,
      enabled: false,
      isPublic: false,
      publicSlug: null,
      now: input.now,
    });
    return { row, created: false };
  }
  const row = await insertTarget(tx, {
    userId: input.userId,
    name: DEMO_PAUSED_NAME,
    url: input.targetUrl,
    method: 'GET',
    intervalSeconds: input.intervalSeconds,
    timeoutMs: 5000,
    expectedStatus: 200,
    headers: null,
    body: null,
    graceThreshold: 2,
    recoveryThreshold: 2,
    enabled: false,
    isPublic: false,
    publicSlug: null,
    now: input.now,
  });
  return { row, created: true };
}

export async function seedDemo(pool: DbPool, input: SeedDemoInput): Promise<SeedDemoResult> {
  const existing = await findUserByEmail(pool, DEMO_EMAIL);
  let passwordHash: string | undefined;
  if (!existing) {
    passwordHash = await argonHash(input.password, ARGON2);
  } else {
    const matches = await argonVerify(existing.passwordHash, input.password).catch(() => false);
    if (!matches) passwordHash = await argonHash(input.password, ARGON2);
  }

  return withTransaction(pool, async (tx) => {
    let createdUser = false;
    let user = await findUserByEmail(tx, DEMO_EMAIL);
    if (!user) {
      user = await insertUser(tx, {
        email: DEMO_EMAIL,
        passwordHash: passwordHash ?? (await argonHash(input.password, ARGON2)),
      });
      createdUser = true;
    } else if (passwordHash) {
      user = (await updateUserPasswordHash(tx, user.id, passwordHash)) ?? user;
    }
    const live = await upsertLiveTarget(tx, { ...input, userId: user.id });
    const paused = await upsertPausedTarget(tx, { ...input, userId: user.id });
    return {
      userId: user.id,
      liveTargetId: live.row.id,
      pausedTargetId: paused.row.id,
      createdUser,
      createdLive: live.created,
      createdPaused: paused.created,
    };
  });
}

async function main(): Promise<void> {
  const parsed = parseSeedEnv(process.env);
  const databaseUrl = rewriteComposeDatabaseUrl(parsed.databaseUrl, await dbHostResolves());
  const pool = createPool(databaseUrl);
  try {
    await migrate(pool);
    const result = await seedDemo(pool, {
      password: parsed.password,
      targetUrl: parsed.targetUrl,
      intervalSeconds: parsed.intervalSeconds,
      graceThreshold: parsed.graceThreshold,
      recoveryThreshold: parsed.recoveryThreshold,
      now: new Date(),
    });
    process.stdout.write(
      `seed ok user=${DEMO_EMAIL} live=${DEMO_LIVE_SLUG} paused=${DEMO_PAUSED_NAME} created_user=${String(result.createdUser)}\n`,
    );
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
