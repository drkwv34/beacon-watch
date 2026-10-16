export { createPool, type DbClient, type DbPool, type Queryable } from './client.js';
export { withTransaction } from './transaction.js';
export { migrate, listMigrationFiles, isMigrationFilename } from './migrate.js';
export { MIGRATIONS_DIR } from './paths.js';
export { isUniqueViolation, conflictIfUnique } from './errors.js';
export { insertUser, findUserByEmail, findUserById, type UserRow } from './repositories/users.js';
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
  listTargetsForUser,
  countTargetsForUser,
  updateTarget,
  deleteTarget,
  claimDueTargets,
  lockTargetForUpdate,
  updateTargetAfterCheck,
  mapTarget,
  toPublicTarget,
  type TargetRow,
} from './repositories/targets.js';
export {
  insertCheck,
  listChecksForTarget,
  countChecksForTarget,
  mapCheck,
  type CheckRow,
} from './repositories/checks.js';
export {
  insertOpenIncident,
  findOpenIncident,
  resolveIncident,
  listIncidentsForTarget,
  mapIncident,
  toPublicIncident,
  OPEN_INCIDENT_INDEX,
  type IncidentRow,
} from './repositories/incidents.js';
