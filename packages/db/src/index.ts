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
  mapTarget,
  toPublicTarget,
  type TargetRow,
} from './repositories/targets.js';
