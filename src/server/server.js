const express = require('express');
const fs = require('fs');
const path = require('path');

const { validateDepartmentData, ensureIDs, isValidHashedSecret } = require('./schema');
const { createUserStore } = require('./userStore');
const { createDepartmentStore } = require('./departmentStore');
const { authenticateLdapUser, testLdapConnection, listLdapUsers } = require('./ldapService');
const { startServer } = require('./httpsService');
const { logAuditEvent } = require('./auditService');
const { restartServer } = require('./serverService');
const { createLockStore } = require('./lockStore');

const { createConfigService } = require('./services/configService');
const { createSessionService } = require('./services/sessionService');
const { createBackupService } = require('./services/backupService');
const { createSseService } = require('./services/sseService');

const { createAuthRouter } = require('./routes/authRoutes');
const { createDepartmentRouter } = require('./routes/departmentRoutes');
const { createProjectRouter } = require('./routes/projectRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const app = express();
const SERVER_STARTED_AT = new Date().toISOString();
const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// 1. Initialize Services
const configService = createConfigService({ repoRoot: REPO_ROOT, processEnv: process.env });
configService.init();

const CONFIG = configService.CONFIG;
const PATHS = configService.PATHS;

const lockStore = createLockStore({ dataDir: PATHS.config, dbName: 'locks.db', logger: console });
const userStore = createUserStore({ dataDir: PATHS.users, dbName: 'users.db', logger: console });
const departmentStore = createDepartmentStore({ dataDir: PATHS.root, enableBak: CONFIG.enableBak, logger: console });

// Helper functions for department data validation and password management
function normalizeDepartmentName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length > 50) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null;
  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) return null;
  return trimmed;
}

function hasDepartmentPassword(data) {
  const secret = data?.password;
  return isValidHashedSecret(secret);
}

function setDepartmentPassword(data, password) {
  const normalizedPassword = configService.normalizeNonEmptyString(password, { trim: true });
  data.password = normalizedPassword ? configService.hashSecret(normalizedPassword) : null;
}

function verifyDepartmentPassword(data, password) {
  const normalizedPassword = configService.normalizeNonEmptyString(password, { trim: true });
  if (!hasDepartmentPassword(data)) return true;
  if (!normalizedPassword) return false;
  return configService.verifyHashedSecret(normalizedPassword, data?.password);
}

function normalizeDepartmentDataForWrite(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.password !== null && data.password !== undefined && !isValidHashedSecret(data.password)) {
    data.password = null;
  }
  return data;
}

function errorResponse(res, statusCode, code, message, details = null) {
  const payload = { error: { code, message } };
  if (details) payload.error.details = details;
  res.status(statusCode).json(payload);
}

const sseService = createSseService({ normalizeDepartmentName });
const sessionService = createSessionService({
  configService,
  lockStore,
  errorResponse,
  normalizeDepartmentName,
  hasDepartmentPassword
});

function readDepartmentData(department) {
  const data = departmentStore.get(department);
  return { data, error: null, filePath: null };
}

function getDepartmentDataOrRespond(res, department) {
  const { data } = readDepartmentData(department);
  if (!data) {
    errorResponse(res, 404, 'NOT_FOUND', 'Department not found');
    return null;
  }
  return data;
}

function writeDepartmentData(department, data, changes = [], updatedBy = null) {
  normalizeDepartmentDataForWrite(data);
  const errors = validateDepartmentData(data);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }
  ensureIDs(data);
  departmentStore.set(department, data);
  sseService.broadcastDepartmentUpdate(department, data, changes, updatedBy);
}

const backupService = createBackupService({
  configService,
  departmentStore,
  userStore,
  lockStore,
  validateDepartmentData,
  normalizeDepartmentName,
  writeDepartmentData
});

function cleanExpiredLocks() {
  lockStore.cleanExpiredLocks();
}

function getLockInfo(department) {
  cleanExpiredLocks();
  const lock = lockStore.get(department);
  if (!lock) {
    return { locked: false, department };
  }
  return {
    locked: true,
    department,
    lockedBy: lock.ownerUserName,
    ownerUserName: lock.ownerUserName,
    ownerType: lock.ownerType,
    lockedAt: lock.lockedAt,
    expiresAt: lock.expiresAt,
    lastHeartbeatAt: lock.lastHeartbeatAt,
    clientHost: lock.clientHost || null
  };
}

function isLockOwner(department, userName) {
  const lock = lockStore.get(department);
  if (!lock) return false;
  return lock.ownerUserName === userName;
}

function getLdapConfigForAuth() {
  return {
    enabled: CONFIG.ldapEnabled,
    log: CONFIG.logLdap,
    url: CONFIG.ldapUrl,
    bindDn: CONFIG.ldapBindDn,
    bindPassword: CONFIG.ldapBindPassword,
    baseDn: CONFIG.ldapBaseDn,
    userFilter: CONFIG.ldapUserFilter,
    requiredGroupDn: CONFIG.ldapRequiredGroup,
    groupSearchBase: CONFIG.ldapGroupSearchBase,
    localFallback: CONFIG.ldapLocalFallback
  };
}

function validateExistingDepartments() {
  try {
    const names = departmentStore.list();
    names.forEach(deptName => {
      const data = departmentStore.get(deptName);
      if (!data) return;
      const errors = validateDepartmentData(data);
      if (errors.length > 0) {
        console.warn(`Validation errors in department ${deptName}:`, errors);
      }
    });
  } catch (err) {
    console.warn('Failed to validate existing departments:', err.message);
  }
}

// 2. Initialize Stores & Timers
configService.ensureDirectories();
userStore.ensureStore();
lockStore.loadFromDisk();
departmentStore.ensureDefaultDepartments(PATHS.departments);
validateExistingDepartments();

lockStore.startCleanup(60 * 1000);
sessionService.startSessionCleanup(60 * 1000);

// 3. Middlewares
app.use(express.json());
app.use('/assets', express.static(path.join(REPO_ROOT, 'artifacts', 'build', 'client')));
app.use(express.static(path.join(REPO_ROOT, 'src', 'public')));

// 4. Shared Context Object for Routers
const ctx = {
  CONFIG,
  PATHS,
  userStore,
  departmentStore,
  lockStore,
  adminTokens: sessionService.adminTokens,
  userSessions: sessionService.userSessions,
  sseClients: sseService.sseClients,
  SERVER_STARTED_AT,
  normalizeDepartmentName,
  readDepartmentData,
  writeDepartmentData,
  getDepartmentDataOrRespond,
  errorResponse,
  hasDepartmentPassword,
  setDepartmentPassword,
  verifyDepartmentPassword,
  grantDepartmentAccess: sessionService.grantDepartmentAccess,
  validateUserSession: sessionService.validateUserSession,
  getValidUserSession: sessionService.getValidUserSession,
  getUserToken: sessionService.getUserToken,
  requireAdmin: sessionService.requireAdmin,
  requireDepartmentAccess: sessionService.requireDepartmentAccess,
  cleanExpiredLocks,
  getLockInfo,
  isLockOwner,
  releaseLocksOwnedByUser: sessionService.releaseLocksOwnedByUser,
  revokeUserSessionsForUser: sessionService.revokeUserSessionsForUser,
  createUserSession: sessionService.createUserSession,
  createAuthLoginResponse: sessionService.createAuthLoginResponse,
  isAdminConfigured: configService.isAdminConfigured,
  isAdminManagedByEnv: configService.isAdminManagedByEnv,
  verifyAdminPassword: configService.verifyAdminPassword,
  persistAdminPassword: configService.persistAdminPassword,
  getLdapConfigForAuth,
  authenticateLdapUser,
  testLdapConnection,
  listLdapUsers,
  getSystemConfigState: configService.getSystemConfigState,
  parseNumber: configService.parseNumber,
  parseBoolean: configService.parseBoolean,
  normalizeSystemConfigValue: configService.normalizeSystemConfigValue,
  writeSystemConfig: configService.writeSystemConfig,
  applySystemConfig: configService.applySystemConfig,
  logAuditEvent,
  restartServer,
  normalizeModules: backupService.normalizeModules,
  hasSelectedModules: backupService.hasSelectedModules,
  buildModularBackup: backupService.buildModularBackup,
  importDepartmentsBackup: backupService.importDepartmentsBackup,
  applyImportedSettings: backupService.applyImportedSettings,
  validateDepartmentData
};

// 5. Mount Routers
app.use(createAuthRouter(ctx));
app.use(createDepartmentRouter(ctx));
app.use(createProjectRouter(ctx));
app.use(createAdminRouter(ctx));

// 6. Start HTTP/HTTPS Server
const PORT = CONFIG.port;
try {
  const { protocol } = startServer(app, {
    port: PORT,
    httpsEnabled: CONFIG.httpsEnabled,
    httpsKeyPath: CONFIG.httpsKeyPath,
    httpsCertPath: CONFIG.httpsCertPath
  });
  console.log(`OnlyGANTT server running on ${protocol}://localhost:${PORT}`);
  console.log(`Data directory: ${path.resolve(PATHS.root)}`);
} catch (err) {
  console.error(`Errore avvio server: ${err.message}`);
  process.exit(1);
}

module.exports = app;
