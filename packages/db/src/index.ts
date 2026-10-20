export { createPool, type DbClient, type DbPool, type Queryable } from './client.js';
export { withTransaction } from './transaction.js';
export { migrate, listMigrationFiles, isMigrationFilename } from './migrate.js';
export { MIGRATIONS_DIR } from './paths.js';
export { isUniqueViolation, conflictIfUnique } from './errors.js';
export {
  insertUser,
  findUserByEmail,
  findUserById,
  updateUserPasswordHash,
  type UserRow,
} from './repositories/users.js';
export {
  insertSession,
  findSessionByTokenHash,
  deleteSessionByTokenHash,
  touchSessionExpiry,
  type SessionRow,
} from './repositories/sessions.js';
export {
  insertTarget,
  findTargetById,
  findPublicTargetBySlug,
  findTargetBySlug,
  findTargetByUserAndName,
  listTargetsForUser,
  countTargetsForUser,
  updateTarget,
  deleteTarget,
  claimDueTargets,
  lockTargetForUpdate,
  setNextCheckAt,
  updateTargetAfterCheck,
  mapTarget,
  toPublicTarget,
  type TargetRow,
} from './repositories/targets.js';
export {
  insertCheck,
  listChecksForTarget,
  latestLatencyByTargetIds,
  countChecksForTarget,
  countSuccessfulChecksForTarget,
  findLatestCheck,
  countChecksSince,
  mapCheck,
  toPublicCheck,
  type CheckRow,
} from './repositories/checks.js';
export {
  insertOpenIncident,
  findOpenIncident,
  resolveIncident,
  listIncidentsForTarget,
  mapIncident,
  toPublicIncident,
  toPublicRecentIncident,
  OPEN_INCIDENT_INDEX,
  type IncidentRow,
} from './repositories/incidents.js';
export {
  DEMO_EMAIL,
  DEMO_LIVE_NAME,
  DEMO_LIVE_SLUG,
  DEMO_LIVE_URL,
  DEMO_PAUSED_NAME,
  parseSeedEnv,
  rewriteComposeDatabaseUrl,
  seedDemo,
  type SeedDemoInput,
  type SeedDemoResult,
} from './seed.js';
