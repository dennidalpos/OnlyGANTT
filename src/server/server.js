const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateDepartmentData, ensureIDs, isValidHashedSecret, HASHED_SECRET_ALGORITHM } = require('./schema');
const { createUserStore } = require('./userStore');
const { createDepartmentStore } = require('./departmentStore');
const { authenticateLdapUser, testLdapConnection, listLdapUsers } = require('./ldapService');
const { startServer } = require('./httpsService');
const { logAuditEvent } = require('./auditService');
const { restartServer } = require('./serverService');
const { createLockStore } = require('./lockStore');

const { createAuthRouter } = require('./routes/authRoutes');
const { createDepartmentRouter } = require('./routes/departmentRoutes');
const { createProjectRouter } = require('./routes/projectRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');

const packageInfo = require('../../package.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const app = express();
const SERVER_STARTED_AT = new Date().toISOString();
const DEFAULT_ADMIN_USER = 'admin';
const SYSTEM_CONFIG_FILE = 'system-config.json';
const SYSTEM_CONFIG_LOCAL_FILE = 'system-config.local.json';
const ADMIN_AUTH_CONFIG_FILE = 'admin-auth.json';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveRepoPath(targetPath, fallbackRelativePath) {
  const candidate = targetPath || fallbackRelativePath;
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.resolve(REPO_ROOT, candidate);
}

const CONFIG = {
  port: parseNumber(process.env.PORT, 3000),
  dataDir: resolveRepoPath(process.env.ONLYGANTT_DATA_DIR || process.env.DATA_DIR, 'Data'),
  enableBak: parseBoolean(process.env.ONLYGANTT_ENABLE_BAK ?? true),
  lockTimeoutMinutes: parseNumber(process.env.ONLYGANTT_LOCK_TIMEOUT_MINUTES, 60),
  userSessionTtlHours: parseNumber(process.env.ONLYGANTT_USER_SESSION_TTL_HOURS, 8),
  adminSessionTtlHours: parseNumber(process.env.ONLYGANTT_ADMIN_TTL_HOURS, 8),
  maxUploadBytes: parseNumber(process.env.ONLYGANTT_MAX_UPLOAD_BYTES, 2000000),
  adminUser: process.env.ONLYGANTT_ADMIN_USER || DEFAULT_ADMIN_USER,
  adminResetCode: process.env.ONLYGANTT_ADMIN_RESET_CODE || null,
  ldapEnabled: parseBoolean(process.env.LDAP_ENABLED),
  logLdap: parseBoolean(process.env.LOG_LDAP),
  ldapUrl: process.env.LDAP_URL || '',
  ldapBindDn: process.env.LDAP_BIND_DN || '',
  ldapBindPassword: process.env.LDAP_BIND_PASSWORD || '',
  ldapBaseDn: process.env.LDAP_BASE_DN || '',
  ldapUserFilter: process.env.LDAP_USER_FILTER || '(sAMAccountName={{username}})',
  ldapRequiredGroup: process.env.LDAP_REQUIRED_GROUP || '',
  ldapGroupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || '',
  ldapLocalFallback: parseBoolean(process.env.LDAP_LOCAL_FALLBACK),
  httpsEnabled: parseBoolean(process.env.HTTPS_ENABLED),
  httpsKeyPath: process.env.HTTPS_KEY_PATH || '',
  httpsCertPath: process.env.HTTPS_CERT_PATH || ''
};

app.use(express.json());
app.use('/assets', express.static(path.join(REPO_ROOT, 'artifacts', 'build', 'client')));
app.use(express.static(path.join(REPO_ROOT, 'src', 'public')));

const PATHS = {
  root: CONFIG.dataDir,
  departments: path.join(CONFIG.dataDir, 'reparti'),
  users: path.join(CONFIG.dataDir, 'utenti'),
  config: path.join(CONFIG.dataDir, 'config'),
  logs: path.join(CONFIG.dataDir, 'log')
};

const lockStore = createLockStore({ dataDir: PATHS.config, fileName: 'locks.json', logger: console });
const adminTokens = new Map();
const userSessions = new Map();
const userStore = createUserStore({ dataDir: PATHS.users, enableBak: CONFIG.enableBak });
const departmentStore = createDepartmentStore({ dataDir: PATHS.root, enableBak: CONFIG.enableBak, logger: console });

// SSE Clients Map
const sseClients = new Map();

function broadcastDepartmentUpdate(department, data) {
  const normalized = normalizeDepartmentName(department);
  const clients = sseClients.get(normalized);
  if (clients && clients.size > 0) {
    const payload = JSON.stringify({
      type: 'update',
      department: normalized,
      revision: data.meta?.revision || 1,
      updatedAt: data.meta?.updatedAt || new Date().toISOString()
    });
    for (const res of clients) {
      res.write(`data: ${payload}\n\n`);
    }
  }
}

const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
const HAS_ENV_ADMIN_PASSWORD = typeof process.env.ONLYGANTT_ADMIN_PASSWORD === 'string' && process.env.ONLYGANTT_ADMIN_PASSWORD.length > 0;
const HAS_ENV_ADMIN_USER = typeof process.env.ONLYGANTT_ADMIN_USER === 'string' && process.env.ONLYGANTT_ADMIN_USER.trim().length > 0;
let adminAuthState = {
  source: 'unconfigured',
  adminUser: CONFIG.adminUser,
  passwordHash: null
};

function normalizeDepartmentName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length > 50) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null;
  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) return null;
  return trimmed;
}

function getSystemConfigFilePath() {
  ensureDataDir();
  return path.join(PATHS.config, SYSTEM_CONFIG_FILE);
}

function getSystemConfigLocalFilePath() {
  ensureDataDir();
  return path.join(PATHS.config, SYSTEM_CONFIG_LOCAL_FILE);
}

function getAdminAuthConfigFilePath() {
  ensureDataDir();
  return path.join(PATHS.config, ADMIN_AUTH_CONFIG_FILE);
}

function ensureDataDir() {
  if (!fs.existsSync(PATHS.root)) {
    fs.mkdirSync(PATHS.root, { recursive: true });
  }
  [PATHS.departments, PATHS.users, PATHS.config, PATHS.logs].forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

function atomicWrite(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  try {
    const fd = fs.openSync(tmpPath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  } catch (err) {
    console.warn(`Unable to fsync temp file ${tmpPath}:`, err.message);
  }
  if (CONFIG.enableBak && fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, bakPath);
    } catch (err) {
      console.warn(`Unable to write backup file ${bakPath}:`, err.message);
    }
  }
  fs.renameSync(tmpPath, filePath);
}

function normalizeNonEmptyString(value, { trim = false } = {}) {
  if (typeof value !== 'string') return null;
  const normalized = trim ? value.trim() : value;
  return normalized ? normalized : null;
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return {
    algorithm: HASHED_SECRET_ALGORITHM,
    salt,
    hash
  };
}

function verifyHashedSecret(secret, record) {
  if (!isValidHashedSecret(record) || typeof secret !== 'string') {
    return false;
  }

  const actualHash = crypto.scryptSync(secret, record.salt, 64);
  const expectedHash = Buffer.from(record.hash, 'hex');

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function hasDepartmentPassword(data) {
  const secret = data?.password;
  return isValidHashedSecret(secret);
}

function setDepartmentPassword(data, password) {
  const normalizedPassword = normalizeNonEmptyString(password, { trim: true });
  data.password = normalizedPassword ? hashSecret(normalizedPassword) : null;
}

function verifyDepartmentPassword(data, password) {
  const normalizedPassword = normalizeNonEmptyString(password, { trim: true });

  if (!hasDepartmentPassword(data)) {
    return true;
  }

  if (!normalizedPassword) {
    return false;
  }

  return verifyHashedSecret(normalizedPassword, data?.password);
}

function normalizeDepartmentDataForWrite(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (data.password !== null && data.password !== undefined && !isValidHashedSecret(data.password)) {
    data.password = null;
  }

  return data;
}

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

function writeDepartmentData(department, data) {
  normalizeDepartmentDataForWrite(data);
  const errors = validateDepartmentData(data);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }
  ensureIDs(data);
  departmentStore.set(department, data);
  broadcastDepartmentUpdate(department, data);
}

function errorResponse(res, statusCode, code, message, details = null) {
  const payload = { error: { code, message } };
  if (details) {
    payload.error.details = details;
  }
  res.status(statusCode).json(payload);
}

function normalizeSystemConfigValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function readJsonObjectFile(filePath, label) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(`Unable to read ${label}:`, err.message);
    return null;
  }
}

function readAdminAuthConfig() {
  try {
    const filePath = getAdminAuthConfigFilePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const adminUser = normalizeNonEmptyString(parsed.adminUser, { trim: true }) || DEFAULT_ADMIN_USER;
    const passwordHash = isValidHashedSecret(parsed.passwordHash) ? parsed.passwordHash : null;
    if (!passwordHash) {
      return null;
    }

    return {
      adminUser,
      passwordHash,
      updatedAt: parsed.updatedAt || null
    };
  } catch (err) {
    console.warn('Unable to read admin auth config:', err.message);
    return null;
  }
}

function writeAdminAuthConfig(configPayload) {
  const filePath = getAdminAuthConfigFilePath();
  atomicWrite(filePath, configPayload);
}

function refreshAdminAuthState() {
  const storedConfig = readAdminAuthConfig();
  const adminUser = HAS_ENV_ADMIN_USER
    ? process.env.ONLYGANTT_ADMIN_USER.trim()
    : storedConfig?.adminUser || CONFIG.adminUser || DEFAULT_ADMIN_USER;

  if (HAS_ENV_ADMIN_PASSWORD) {
    adminAuthState = {
      source: 'env',
      adminUser,
      passwordHash: null
    };
  } else if (storedConfig?.passwordHash) {
    adminAuthState = {
      source: 'file',
      adminUser,
      passwordHash: storedConfig.passwordHash
    };
  } else {
    adminAuthState = {
      source: 'unconfigured',
      adminUser,
      passwordHash: null
    };
  }

  CONFIG.adminUser = adminAuthState.adminUser;
}

function isAdminConfigured() {
  return adminAuthState.source !== 'unconfigured';
}

function isAdminManagedByEnv() {
  return adminAuthState.source === 'env';
}

function verifyAdminPassword(password) {
  if (!isAdminConfigured() || typeof password !== 'string' || !password) {
    return false;
  }

  if (adminAuthState.source === 'env') {
    return password === process.env.ONLYGANTT_ADMIN_PASSWORD;
  }

  return verifyHashedSecret(password, adminAuthState.passwordHash);
}

function persistAdminPassword(newPassword) {
  const password = normalizeNonEmptyString(newPassword);
  if (!password) {
    throw new Error('Admin password is required');
  }

  const payload = {
    adminUser: CONFIG.adminUser,
    passwordHash: hashSecret(password),
    updatedAt: new Date().toISOString()
  };

  writeAdminAuthConfig(payload);
  refreshAdminAuthState();
}

function persistAdminUser(adminUser) {
  const normalizedAdminUser = normalizeNonEmptyString(adminUser, { trim: true });
  if (!normalizedAdminUser) {
    return;
  }

  CONFIG.adminUser = normalizedAdminUser;

  if (isAdminManagedByEnv() || adminAuthState.source !== 'file') {
    refreshAdminAuthState();
    return;
  }

  writeAdminAuthConfig({
    adminUser: normalizedAdminUser,
    passwordHash: adminAuthState.passwordHash,
    updatedAt: new Date().toISOString()
  });
  refreshAdminAuthState();
}

function buildSystemConfigPayload(config, { includeBindPassword = false } = {}) {
  return {
    server: {
      lockTimeoutMinutes: config.lockTimeoutMinutes,
      userSessionTtlHours: config.userSessionTtlHours,
      adminSessionTtlHours: config.adminSessionTtlHours,
      maxUploadBytes: config.maxUploadBytes,
      enableBak: parseBoolean(config.enableBak)
    },
    ldap: {
      enabled: parseBoolean(config.ldapEnabled),
      log: parseBoolean(config.logLdap),
      url: config.ldapUrl || '',
      bindDn: config.ldapBindDn || '',
      bindPasswordSet: !!config.ldapBindPassword,
      ...(includeBindPassword ? { bindPassword: config.ldapBindPassword || '' } : {}),
      baseDn: config.ldapBaseDn || '',
      userFilter: config.ldapUserFilter || '(sAMAccountName={{username}})',
      requiredGroupDn: config.ldapRequiredGroup || '',
      groupSearchBase: config.ldapGroupSearchBase || '',
      localFallback: parseBoolean(config.ldapLocalFallback)
    },
    https: {
      enabled: parseBoolean(config.httpsEnabled),
      keyPath: config.httpsKeyPath || '',
      certPath: config.httpsCertPath || ''
    }
  };
}

function getSystemConfigState(options = {}) {
  return buildSystemConfigPayload(CONFIG, options);
}

function applySystemConfig(configPayload = {}) {
  const serverConfig = configPayload.server || {};
  const ldapConfig = configPayload.ldap || {};
  const httpsConfig = configPayload.https || {};

  if (typeof serverConfig.lockTimeoutMinutes === 'number') {
    CONFIG.lockTimeoutMinutes = serverConfig.lockTimeoutMinutes;
  }
  if (typeof serverConfig.userSessionTtlHours === 'number') {
    CONFIG.userSessionTtlHours = serverConfig.userSessionTtlHours;
  }
  if (typeof serverConfig.adminSessionTtlHours === 'number') {
    CONFIG.adminSessionTtlHours = serverConfig.adminSessionTtlHours;
  }
  if (typeof serverConfig.maxUploadBytes === 'number') {
    CONFIG.maxUploadBytes = serverConfig.maxUploadBytes;
  }
  if (typeof serverConfig.enableBak === 'boolean') {
    CONFIG.enableBak = serverConfig.enableBak;
  }

  if (typeof ldapConfig.enabled === 'boolean') CONFIG.ldapEnabled = ldapConfig.enabled;
  if (typeof ldapConfig.log === 'boolean') CONFIG.logLdap = ldapConfig.log;
  if (typeof ldapConfig.url === 'string') CONFIG.ldapUrl = ldapConfig.url;
  if (typeof ldapConfig.bindDn === 'string') CONFIG.ldapBindDn = ldapConfig.bindDn;
  if (typeof ldapConfig.bindPassword === 'string') CONFIG.ldapBindPassword = ldapConfig.bindPassword;
  if (typeof ldapConfig.baseDn === 'string') CONFIG.ldapBaseDn = ldapConfig.baseDn;
  if (typeof ldapConfig.userFilter === 'string') CONFIG.ldapUserFilter = ldapConfig.userFilter;
  if (typeof ldapConfig.requiredGroupDn === 'string') CONFIG.ldapRequiredGroup = ldapConfig.requiredGroupDn;
  if (typeof ldapConfig.groupSearchBase === 'string') CONFIG.ldapGroupSearchBase = ldapConfig.groupSearchBase;
  if (typeof ldapConfig.localFallback === 'boolean') CONFIG.ldapLocalFallback = ldapConfig.localFallback;

  if (typeof httpsConfig.enabled === 'boolean') CONFIG.httpsEnabled = httpsConfig.enabled;
  if (typeof httpsConfig.keyPath === 'string') CONFIG.httpsKeyPath = httpsConfig.keyPath;
  if (typeof httpsConfig.certPath === 'string') CONFIG.httpsCertPath = httpsConfig.certPath;
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

function readSystemConfig() {
  const baseConfig = readJsonObjectFile(getSystemConfigFilePath(), 'system config');
  const localConfig = readJsonObjectFile(getSystemConfigLocalFilePath(), 'local system config');

  if (!baseConfig && !localConfig) return null;

  const mergedConfig = {
    ...(baseConfig || {})
  };

  if (localConfig?.ldap && typeof localConfig.ldap === 'object') {
    mergedConfig.ldap = {
      ...(mergedConfig.ldap && typeof mergedConfig.ldap === 'object' ? mergedConfig.ldap : {}),
      ...localConfig.ldap
    };
  }

  return mergedConfig;
}

function writeSystemConfig(configPayload) {
  const filePath = getSystemConfigFilePath();
  const localFilePath = getSystemConfigLocalFilePath();
  const existingLocalConfig = readJsonObjectFile(localFilePath, 'local system config') || {};
  const persistedConfig = {
    ...(configPayload && typeof configPayload === 'object' ? configPayload : {})
  };

  const persistedLdap = {
    ...(persistedConfig.ldap && typeof persistedConfig.ldap === 'object' ? persistedConfig.ldap : {})
  };
  const hasBindPassword = Object.prototype.hasOwnProperty.call(persistedLdap, 'bindPassword');
  const nextBindPassword = hasBindPassword
    ? normalizeSystemConfigValue(persistedLdap.bindPassword, '')
    : normalizeSystemConfigValue(existingLocalConfig?.ldap?.bindPassword, '');

  delete persistedLdap.bindPassword;
  delete persistedLdap.bindPasswordSet;

  if (persistedConfig.ldap && typeof persistedConfig.ldap === 'object') {
    persistedConfig.ldap = persistedLdap;
  }

  atomicWrite(filePath, persistedConfig);

  if (nextBindPassword) {
    atomicWrite(localFilePath, {
      ldap: {
        bindPassword: nextBindPassword
      }
    });
  } else if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }
}

const storedSystemConfig = readSystemConfig();
if (storedSystemConfig) {
  applySystemConfig(storedSystemConfig);
}
refreshAdminAuthState();

function isValidAdminToken(token) {
  if (!token) return false;
  const session = adminTokens.get(token);
  if (!session) return false;
  if (new Date() > new Date(session.expiresAt)) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function cleanupExpiredUserSessions() {
  const now = Date.now();
  for (const [token, session] of userSessions.entries()) {
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= now) {
      if (session?.userName) {
        releaseLocksOwnedByUser(session.userName);
      }
      userSessions.delete(token);
    }
  }
}

function releaseLocksOwnedByUser(userName) {
  if (!userName) return;
  for (const [department, lock] of lockStore.entries()) {
    if (lock?.ownerUserName === userName) {
      lockStore.remove(department);
    }
  }
}

function revokeUserSessionsForUser(userName) {
  if (!userName) return;
  const normalizedUserName = userName.trim().toLowerCase();
  for (const [token, session] of userSessions.entries()) {
    if ((session?.userName || '').trim().toLowerCase() === normalizedUserName) {
      userSessions.delete(token);
    }
  }
  releaseLocksOwnedByUser(userName);
}

function createUserSession(userName, { userType = 'user', department = null } = {}) {
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIG.userSessionTtlHours * 60 * 60 * 1000);
  const normalizedDepartment = normalizeDepartmentName(department);
  userSessions.set(token, {
    userName,
    userType,
    department: normalizedDepartment,
    departmentGrants: [],
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
  return token;
}

function createAuthLoginResponse(userId, { authType, sessionUserType = authType, user }) {
  revokeUserSessionsForUser(userId);
  const token = createUserSession(userId, {
    userType: sessionUserType,
    department: user?.department || null
  });
  return {
    ok: true,
    authType,
    token,
    user: {
      userId,
      ...user
    }
  };
}

function getUserToken(req) {
  return req.headers['x-user-token'] || req.body?.userToken || null;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

function validateUserSession(req, res, userName) {
  if (!userName || typeof userName !== 'string') {
    errorResponse(res, 400, 'INVALID_REQUEST', 'userName is required');
    return false;
  }

  const normalizedUserName = userName.trim();
  const token = getUserToken(req);
  if (!token) {
    errorResponse(res, 401, 'UNAUTHORIZED', 'User token required');
    return false;
  }

  cleanupExpiredUserSessions();
  const session = userSessions.get(token);
  if (!session || session.userName !== normalizedUserName) {
    errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
    return false;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    userSessions.delete(token);
    errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
    return false;
  }

  session.lastSeenAt = new Date().toISOString();
  session.expiresAt = new Date(Date.now() + CONFIG.userSessionTtlHours * 60 * 60 * 1000).toISOString();
  userSessions.set(token, session);

  if (req.body && typeof req.body === 'object') {
    req.body.userName = normalizedUserName;
  }

  req.userSession = session;
  return session;
}

function getValidUserSession(token) {
  if (!token) return null;

  cleanupExpiredUserSessions();
  const session = userSessions.get(token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    userSessions.delete(token);
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  session.expiresAt = new Date(Date.now() + CONFIG.userSessionTtlHours * 60 * 60 * 1000).toISOString();
  userSessions.set(token, session);
  return session;
}

function requireAdmin(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Admin authentication required');
  }
  if (!isValidAdminToken(token)) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired admin token');
  }
  next();
}

function getRequestPrincipal(req) {
  const userToken = getUserToken(req);
  const userSession = getValidUserSession(userToken);
  if (userSession) {
    return { type: userSession.userType === 'admin' ? 'admin' : 'user', session: userSession };
  }

  const adminToken = getBearerToken(req);
  if (isValidAdminToken(adminToken)) {
    return {
      type: 'admin',
      session: {
        userName: CONFIG.adminUser,
        userType: 'admin',
        department: null,
        departmentGrants: []
      }
    };
  }

  return null;
}

function sessionHasDepartmentScope(session, department) {
  if (!session?.department) return true;
  const scopedDepartment = normalizeDepartmentName(session.department);
  const requestedDepartment = normalizeDepartmentName(department);
  return !!scopedDepartment &&
    !!requestedDepartment &&
    scopedDepartment.toLowerCase() === requestedDepartment.toLowerCase();
}

function sessionHasDepartmentGrant(session, department, data) {
  if (!hasDepartmentPassword(data)) return true;
  const requestedDepartment = normalizeDepartmentName(department);
  if (!requestedDepartment) return false;
  return Array.isArray(session?.departmentGrants) &&
    session.departmentGrants.some((item) => (
      typeof item === 'string' &&
      item.toLowerCase() === requestedDepartment.toLowerCase()
    ));
}

function grantDepartmentAccess(req, department) {
  const token = getUserToken(req);
  const session = getValidUserSession(token);
  const normalizedDepartment = normalizeDepartmentName(department);
  if (!session || !normalizedDepartment || session.userType === 'admin') {
    return;
  }
  if (!Array.isArray(session.departmentGrants)) {
    session.departmentGrants = [];
  }
  if (!session.departmentGrants.some((item) => item.toLowerCase() === normalizedDepartment.toLowerCase())) {
    session.departmentGrants.push(normalizedDepartment);
  }
}

function requireDepartmentAccess(req, res, department, data) {
  const normalizedDepartment = normalizeDepartmentName(department);
  if (!normalizedDepartment) {
    errorResponse(res, 400, 'INVALID_NAME', 'Invalid department name');
    return null;
  }

  const principal = getRequestPrincipal(req);
  if (!principal) {
    errorResponse(res, 401, 'UNAUTHORIZED', 'User session required');
    return null;
  }

  if (principal.type === 'admin') {
    req.userSession = principal.session;
    return principal.session;
  }

  if (!sessionHasDepartmentScope(principal.session, normalizedDepartment)) {
    errorResponse(res, 403, 'DEPARTMENT_FORBIDDEN', 'User is not authorized for this department');
    return null;
  }

  if (hasDepartmentPassword(data) && !sessionHasDepartmentGrant(principal.session, normalizedDepartment, data)) {
    errorResponse(res, 403, 'DEPARTMENT_PASSWORD_REQUIRED', 'Department password verification required');
    return null;
  }

  req.userSession = principal.session;
  return principal.session;
}

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

ensureDataDir();
userStore.ensureStore();
lockStore.loadFromDisk();
departmentStore.runMigrations(PATHS.departments);

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

validateExistingDepartments();

function normalizeModules(modules = {}) {
  return {
    departments: !!modules.departments,
    users: !!modules.users,
    settings: !!modules.settings
  };
}

function hasSelectedModules(modules) {
  return Object.values(modules).some(Boolean);
}

function collectDepartmentBackups() {
  const names = departmentStore.list();
  const departments = [];

  for (const deptName of names) {
    const data = departmentStore.get(deptName);
    if (!data) continue;
    departments.push({
      name: deptName,
      data
    });
  }

  return departments;
}

function buildModularBackup(modules) {
  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    modules: {
      departments: modules.departments ? { data: collectDepartmentBackups() } : { data: null },
      users: modules.users ? { data: userStore.exportUsers() } : { data: null },
      settings: modules.settings ? {
        data: {
          systemConfig: getSystemConfigState(),
          serverConfig: {
            lockTimeoutMinutes: CONFIG.lockTimeoutMinutes,
            userSessionTtlHours: CONFIG.userSessionTtlHours,
            adminSessionTtlHours: CONFIG.adminSessionTtlHours,
            maxUploadBytes: CONFIG.maxUploadBytes,
            enableBak: CONFIG.enableBak
          },
          adminCredentials: {
            adminUser: CONFIG.adminUser
          }
        }
      } : { data: null }
    }
  };
}

function applyImportedSettings(payload = {}) {
  const serverConfig = payload.serverConfig || {};
  const adminCredentials = payload.adminCredentials || {};
  const systemConfig = payload.systemConfig || {};
  const applied = {};

  if (systemConfig && typeof systemConfig === 'object') {
    applySystemConfig(systemConfig);
    writeSystemConfig(getSystemConfigState());
    if (Object.keys(systemConfig).length > 0) {
      applied.systemConfig = true;
    }
  }

  if (typeof serverConfig.lockTimeoutMinutes === 'number') {
    CONFIG.lockTimeoutMinutes = serverConfig.lockTimeoutMinutes;
    applied.lockTimeoutMinutes = CONFIG.lockTimeoutMinutes;
  }
  if (typeof serverConfig.userSessionTtlHours === 'number') {
    CONFIG.userSessionTtlHours = serverConfig.userSessionTtlHours;
    applied.userSessionTtlHours = CONFIG.userSessionTtlHours;
  }
  if (typeof serverConfig.adminSessionTtlHours === 'number') {
    CONFIG.adminSessionTtlHours = serverConfig.adminSessionTtlHours;
    applied.adminSessionTtlHours = CONFIG.adminSessionTtlHours;
  }
  if (typeof serverConfig.maxUploadBytes === 'number') {
    CONFIG.maxUploadBytes = serverConfig.maxUploadBytes;
    applied.maxUploadBytes = CONFIG.maxUploadBytes;
  }
  if (typeof serverConfig.enableBak === 'boolean') {
    CONFIG.enableBak = serverConfig.enableBak;
    applied.enableBak = CONFIG.enableBak;
  }
  if (typeof adminCredentials.adminUser === 'string' && adminCredentials.adminUser.trim()) {
    persistAdminUser(adminCredentials.adminUser);
    applied.adminUser = CONFIG.adminUser;
  }

  if (Object.keys(applied).length > 0) {
    writeSystemConfig(getSystemConfigState());
  }

  return applied;
}

function importDepartmentsBackup(departments, overwriteExisting) {
  const results = {
    imported: [],
    skipped: [],
    errors: []
  };

  for (const dept of departments) {
    if (!dept.name || !dept.data) {
      results.errors.push({
        department: dept.name || 'unknown',
        error: 'Missing name or data'
      });
      continue;
    }

    const normalized = normalizeDepartmentName(dept.name);
    if (!normalized) {
      results.errors.push({
        department: dept.name,
        error: 'Invalid department name'
      });
      continue;
    }

    if (departmentStore.exists(normalized) && !overwriteExisting) {
      results.skipped.push({
        department: normalized,
        reason: 'Already exists (use overwriteExisting flag to replace)'
      });
      continue;
    }

    try {
      const errors = validateDepartmentData(dept.data);
      if (errors.length > 0) {
        results.errors.push({
          department: normalized,
          error: 'Validation failed',
          details: errors
        });
        continue;
      }

      const dataToWrite = {
        ...dept.data,
        meta: {
          ...dept.data.meta,
          importedAt: new Date().toISOString(),
          importedBy: 'admin'
        }
      };

      writeDepartmentData(normalized, dataToWrite);
      results.imported.push(normalized);

      lockStore.remove(normalized);
    } catch (err) {
      results.errors.push({
        department: normalized,
        error: err.message
      });
    }
  }

  return results;
}

lockStore.startCleanup(60 * 1000);
setInterval(cleanupExpiredUserSessions, 60 * 1000).unref?.();

// Shared Context Object for Routers
const ctx = {
  CONFIG,
  PATHS,
  userStore,
  departmentStore,
  lockStore,
  adminTokens,
  userSessions,
  sseClients,
  SERVER_STARTED_AT,
  normalizeDepartmentName,
  readDepartmentData,
  writeDepartmentData,
  getDepartmentDataOrRespond,
  errorResponse,
  hasDepartmentPassword,
  setDepartmentPassword,
  verifyDepartmentPassword,
  grantDepartmentAccess,
  validateUserSession,
  getValidUserSession,
  getUserToken,
  requireAdmin,
  requireDepartmentAccess,
  cleanExpiredLocks,
  getLockInfo,
  isLockOwner,
  releaseLocksOwnedByUser,
  revokeUserSessionsForUser,
  createUserSession,
  createAuthLoginResponse,
  isAdminConfigured,
  isAdminManagedByEnv,
  verifyAdminPassword,
  persistAdminPassword,
  getLdapConfigForAuth,
  authenticateLdapUser,
  testLdapConnection,
  listLdapUsers,
  getSystemConfigState,
  parseNumber,
  parseBoolean,
  normalizeSystemConfigValue,
  writeSystemConfig,
  applySystemConfig,
  logAuditEvent,
  restartServer,
  normalizeModules,
  hasSelectedModules,
  buildModularBackup,
  importDepartmentsBackup,
  applyImportedSettings,
  validateDepartmentData
};

// Mount Routers
app.use(createAuthRouter(ctx));
app.use(createDepartmentRouter(ctx));
app.use(createProjectRouter(ctx));
app.use(createAdminRouter(ctx));

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
