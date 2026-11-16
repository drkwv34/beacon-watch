import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { DomainError, isUuid, type UserId } from '@beacon-watch/domain';
import {
  insertApiToken,
  listApiTokensForUser,
  revokeApiTokenForUser,
  toPublicApiToken,
  type DbPool,
} from '@beacon-watch/db';
import type { ApiConfig } from '../../config.js';
import { hashApiToken } from '../auth/service.js';

export class TokenService {
  constructor(
    private readonly pool: DbPool,
    private readonly config: ApiConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly randomBytes: (size: number) => Buffer = (size) => nodeRandomBytes(size),
  ) {}

  mint(): { token: string; prefix: string } {
    const prefix = `bw_${this.randomBytes(6).toString('base64url')}`;
    const secret = this.randomBytes(32).toString('base64url');
    return { token: `${prefix}_${secret}`, prefix };
  }

  async create(
    userId: UserId,
    input: { label: string; expires_at?: string | undefined },
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    const expiresAt = parseExpiresAt(input.expires_at, now);
    const minted = this.mint();
    const row = await insertApiToken(this.pool, {
      userId,
      tokenHash: hashApiToken(this.config.SESSION_SECRET, minted.token),
      prefix: minted.prefix,
      label: input.label,
      expiresAt,
    });
    return { ...toPublicApiToken(row), token: minted.token };
  }

  async list(userId: UserId): Promise<Record<string, unknown>[]> {
    const rows = await listApiTokensForUser(this.pool, userId);
    return rows.map(toPublicApiToken);
  }

  async revoke(userId: UserId, rawId: string): Promise<void> {
    if (!isUuid(rawId)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid token id', { fields: { id: 'must be a uuid' } });
    }
    const row = await revokeApiTokenForUser(this.pool, { id: rawId, userId, now: this.now() });
    if (!row) throw new DomainError('NOT_FOUND', 'Token not found');
  }
}

function parseExpiresAt(raw: string | undefined, now: Date): Date | null {
  if (raw === undefined || raw === '') return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid expiry', {
      fields: { expires_at: 'must be an ISO-8601 datetime' },
    });
  }
  if (at.getTime() <= now.getTime()) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid expiry', { fields: { expires_at: 'must be in the future' } });
  }
  return at;
}
