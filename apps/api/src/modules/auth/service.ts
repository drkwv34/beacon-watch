import { createHmac, randomBytes as nodeRandomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { DomainError, type UserId } from '@beacon-watch/domain';
import {
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  insertSession,
  insertUser,
  touchSessionExpiry,
  withTransaction,
  type DbPool,
  type UserRow,
} from '@beacon-watch/db';
import type { ApiConfig } from '../../config.js';

const ARGON2 = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyPasswordHash: string | undefined;

async function dummyHash(): Promise<string> {
  dummyPasswordHash ??= await argonHash('not-a-real-password', ARGON2);
  return dummyPasswordHash;
}

export interface AuthUser {
  id: UserId;
  email: string;
}

export interface SessionContext {
  user: AuthUser;
  tokenHash: string;
  sessionId: string;
  expiresAt: Date;
}

export function hashSessionToken(secret: string, token: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function publicUser(user: UserRow): AuthUser {
  return { id: user.id, email: user.email };
}

export class AuthService {
  constructor(
    private readonly pool: DbPool,
    private readonly config: ApiConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly randomBytes: (size: number) => Buffer = (size) => nodeRandomBytes(size),
  ) {}

  newToken(): string {
    return this.randomBytes(32).toString('base64url');
  }

  expiresAtFrom(now: Date): Date {
    return new Date(now.getTime() + this.config.SESSION_TTL_SECONDS * 1000);
  }

  async register(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; token: string; csrf: string; expiresAt: Date }> {
    const passwordHash = await argonHash(input.password, ARGON2);
    const now = this.now();
    return withTransaction(this.pool, async (tx) => {
      const user = await insertUser(tx, { email: input.email, passwordHash });
      return this.issueSession(tx, user, now);
    });
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; token: string; csrf: string; expiresAt: Date }> {
    const user = await findUserByEmail(this.pool, input.email);
    const hash = user?.passwordHash ?? (await dummyHash());
    let ok: boolean;
    try {
      ok = await argonVerify(hash, input.password);
    } catch {
      ok = false;
    }
    if (!user || !ok) {
      throw new DomainError('UNAUTHENTICATED', 'Invalid email or password');
    }
    const now = this.now();
    return withTransaction(this.pool, async (tx) => this.issueSession(tx, user, now));
  }

  async logout(token: string): Promise<void> {
    const tokenHash = hashSessionToken(this.config.SESSION_SECRET, token);
    await deleteSessionByTokenHash(this.pool, tokenHash);
  }

  async me(userId: UserId): Promise<AuthUser> {
    const user = await findUserById(this.pool, userId);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Session expired');
    return publicUser(user);
  }

  async resolveSession(token: string | undefined): Promise<SessionContext | undefined> {
    if (!token) return undefined;
    const tokenHash = hashSessionToken(this.config.SESSION_SECRET, token);
    const session = await findSessionByTokenHash(this.pool, tokenHash);
    if (!session) return undefined;
    const now = this.now();
    if (session.expiresAt.getTime() <= now.getTime()) {
      await deleteSessionByTokenHash(this.pool, tokenHash);
      return undefined;
    }
    const remaining = session.expiresAt.getTime() - now.getTime();
    const ttlMs = this.config.SESSION_TTL_SECONDS * 1000;
    if (remaining < ttlMs - 24 * 60 * 60 * 1000) {
      const expiresAt = this.expiresAtFrom(now);
      await touchSessionExpiry(this.pool, session.id, expiresAt);
      session.expiresAt = expiresAt;
    }
    const user = await findUserById(this.pool, session.userId);
    if (!user) {
      await deleteSessionByTokenHash(this.pool, tokenHash);
      return undefined;
    }
    return { user: publicUser(user), tokenHash, sessionId: session.id, expiresAt: session.expiresAt };
  }

  private async issueSession(
    tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
    user: UserRow,
    now: Date,
  ): Promise<{ user: AuthUser; token: string; csrf: string; expiresAt: Date }> {
    const token = this.newToken();
    const csrf = this.newToken();
    const expiresAt = this.expiresAtFrom(now);
    await insertSession(tx, {
      userId: user.id,
      tokenHash: hashSessionToken(this.config.SESSION_SECRET, token),
      expiresAt,
    });
    return { user: publicUser(user), token, csrf, expiresAt };
  }
}

export function csrfMatches(cookie: string | undefined, header: string | undefined): boolean {
  if (!cookie || !header) return false;
  const left = Buffer.from(cookie);
  const right = Buffer.from(header);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
