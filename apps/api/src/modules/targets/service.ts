import {
  DomainError,
  MAX_TARGETS_PER_USER,
  asTargetId,
  isUuid,
  validateTargetInput,
  type TargetInput,
  type TargetPatch,
  type UserId,
} from '@beacon-watch/domain';
import {
  countTargetsForUser,
  deleteTarget,
  findTargetById,
  insertTarget,
  listTargetsForUser,
  updateTarget,
  withTransaction,
  type DbPool,
  type TargetRow,
} from '@beacon-watch/db';
import type { ApiConfig } from '../../config.js';
import { assertUrlAllowed, type LookupFn } from '../../lookup.js';

function requireTargetId(id: string) {
  if (!isUuid(id))
    throw new DomainError('VALIDATION_FAILED', 'Invalid target id', { fields: { id: 'must be a uuid' } });
  return asTargetId(id);
}

async function loadOwned(pool: DbPool, userId: UserId, rawId: string): Promise<TargetRow> {
  const id = requireTargetId(rawId);
  const row = await findTargetById(pool, id);
  if (!row) throw new DomainError('NOT_FOUND', 'Target not found');
  if (row.userId !== userId) throw new DomainError('FORBIDDEN', 'Not the target owner');
  return row;
}

export class TargetService {
  constructor(
    private readonly pool: DbPool,
    private readonly config: ApiConfig,
    private readonly lookup: LookupFn,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: UserId, input: TargetInput): Promise<TargetRow> {
    const validated = validateTargetInput(input);
    await assertUrlAllowed(validated.url, this.config, this.lookup);
    const now = this.now();
    return withTransaction(this.pool, async (tx) => {
      const count = await countTargetsForUser(tx, userId);
      if (count >= MAX_TARGETS_PER_USER) {
        throw new DomainError('VALIDATION_FAILED', 'Target limit reached', {
          fields: { name: `at most ${MAX_TARGETS_PER_USER} targets` },
        });
      }
      return insertTarget(tx, {
        userId,
        name: validated.name,
        url: validated.url,
        method: validated.method,
        intervalSeconds: validated.interval_seconds,
        timeoutMs: validated.timeout_ms,
        expectedStatus: validated.expected_status,
        headers: validated.headers,
        body: validated.body,
        graceThreshold: validated.grace_threshold,
        recoveryThreshold: validated.recovery_threshold,
        enabled: validated.enabled,
        isPublic: validated.is_public,
        publicSlug: validated.public_slug,
        now,
      });
    });
  }

  async list(userId: UserId, limit: number): Promise<TargetRow[]> {
    return listTargetsForUser(this.pool, userId, { limit });
  }

  async get(userId: UserId, id: string): Promise<TargetRow> {
    return loadOwned(this.pool, userId, id);
  }

  async update(userId: UserId, id: string, patch: TargetPatch): Promise<TargetRow> {
    const existing = await loadOwned(this.pool, userId, id);
    const merged: TargetInput = {
      name: patch.name ?? existing.name,
      url: patch.url ?? existing.url,
      method: patch.method ?? existing.method,
      interval_seconds: patch.interval_seconds ?? existing.intervalSeconds,
      timeout_ms: patch.timeout_ms ?? existing.timeoutMs,
      expected_status: patch.expected_status ?? existing.expectedStatus,
      headers: patch.headers === undefined ? existing.headers : patch.headers,
      body: patch.body === undefined ? existing.body : patch.body,
      grace_threshold: patch.grace_threshold ?? existing.graceThreshold,
      recovery_threshold: patch.recovery_threshold ?? existing.recoveryThreshold,
      enabled: patch.enabled ?? existing.enabled,
      is_public: patch.is_public ?? existing.isPublic,
      public_slug: patch.public_slug === undefined ? existing.publicSlug : patch.public_slug,
    };
    const validated = validateTargetInput(merged);
    await assertUrlAllowed(validated.url, this.config, this.lookup);
    const now = this.now();
    return withTransaction(this.pool, async (tx) =>
      updateTarget(tx, existing.id, {
        name: validated.name,
        url: validated.url,
        method: validated.method,
        intervalSeconds: validated.interval_seconds,
        timeoutMs: validated.timeout_ms,
        expectedStatus: validated.expected_status,
        headers: validated.headers,
        body: validated.body,
        graceThreshold: validated.grace_threshold,
        recoveryThreshold: validated.recovery_threshold,
        enabled: validated.enabled,
        isPublic: validated.is_public,
        publicSlug: validated.public_slug,
        now,
      }),
    );
  }

  async remove(userId: UserId, id: string): Promise<void> {
    const existing = await loadOwned(this.pool, userId, id);
    await deleteTarget(this.pool, existing.id);
  }
}
