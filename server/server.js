const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { validateDepartmentData, ensureIDs } = require('./schema');
const { createUserStore } = require('./userStore');
const { authenticateLdapUser, testLdapConnection, listLdapUsers } = require('./ldapService');
const { startServer } = require('./httpsService');
const { logAuditEvent } = require('./auditService');
const { restartServer } = require('./serverService');
const { createLockStore } = require('./lockStore');

const packageInfo = require('../package.json');

const app = express();
const SERVER_STARTED_AT = new Date().toISOString();

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

const CONFIG = {
  port: parseNumber(process.env.PORT, 3000),
  dataDir: process.env.ONLYGANTT_DATA_DIR || process.env.DATA_DIR || 'Data',
  enableBak: parseBoolean(process.env.ONLYGANTT_ENABLE_BAK ?? true),
  lockTimeoutMinutes: parseNumber(process.env.ONLYGANTT_LOCK_TIMEOUT_MINUTES, 60),
  adminSessionTtlHours: parseNumber(process.env.ONLYGANTT_ADMIN_TTL_HOURS, 8),
  maxUploadBytes: parseNumber(process.env.ONLYGANTT_MAX_UPLOAD_BYTES, 2000000),
  adminUser: process.env.ONLYGANTT_ADMIN_USER || 'admin',
  adminPassword: process.env.ONLYGANTT_ADMIN_PASSWORD || 'admin123',
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
app.use(express.static('public'));
app.use('/src', express.static('src'));

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

const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
const SYSTEM_CONFIG_FILE = 'system-config.json';

function normalizeDepartmentName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length > 50) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null;
  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) return null;
  return trimmed;
}

function isDepartmentFile(fileName) {
  return fileName.endsWith('.json') && !fileName.endsWith('.bak') && !fileName.endsWith('.tmp');
}

function getDepartmentFilePath(department) {
  const normalized = normalizeDepartmentName(department);
  if (!normalized) return null;
  return path.join(PATHS.departments, `${normalized}.json`);
}

function getSystemConfigFilePath() {
  ensureDataDir();
  return path.join(PATHS.config, SYSTEM_CONFIG_FILE);
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
  if (CONFIG.enableBak && fs.existsSync(filePath)) {
    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
    }
    fs.copyFileSync(filePath, bakPath);
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  fs.renameSync(tmpPath, filePath);
}

function readDepartmentData(department) {
  const filePath = getDepartmentFilePath(department);
  if (!filePath || !fs.existsSync(filePath)) {
    return { data: null, error: null, filePath };
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return { data, error: null, filePath };
  } catch (err) {
    err.code = 'INVALID_JSON';
    err.department = department;
    err.filePath = filePath;
    return { data: null, error: err, filePath };
  }
}

function getDepartmentDataOrRespond(res, department) {
  const { data, error, filePath } = readDepartmentData(department);
  if (error) {
    errorResponse(res, 500, 'INVALID_JSON', `Invalid JSON data for department ${department}`, {
      file: path.basename(filePath)
    });
    return null;
  }
  if (!data) {
    errorResponse(res, 404, 'NOT_FOUND', 'Department not found');
    return null;
  }
  return data;
}

function writeDepartmentData(department, data) {
  const filePath = getDepartmentFilePath(department);
  if (!filePath) {
    throw new Error('Invalid department name');
  }
  const errors = validateDepartmentData(data);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }
  ensureIDs(data);
  atomicWrite(filePath, data);
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

function buildSystemConfigPayload(config, { includeBindPassword = true } = {}) {
  return {
    ldap: {
      enabled: parseBoolean(config.ldapEnabled),
      log: parseBoolean(config.logLdap),
      url: config.ldapUrl || '',
      bindDn: config.ldapBindDn || '',
      bindPassword: includeBindPassword ? (config.ldapBindPassword || '') : '',
      bindPasswordSet: !!config.ldapBindPassword,
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

function getSystemConfigState() {
  return {
    ldap: {
      enabled: parseBoolean(CONFIG.ldapEnabled),
      log: parseBoolean(CONFIG.logLdap),
      url: CONFIG.ldapUrl || '',
      bindDn: CONFIG.ldapBindDn || '',
      bindPassword: CONFIG.ldapBindPassword || '',
      baseDn: CONFIG.ldapBaseDn || '',
      userFilter: CONFIG.ldapUserFilter || '(sAMAccountName={{username}})',
      requiredGroupDn: CONFIG.ldapRequiredGroup || '',
      groupSearchBase: CONFIG.ldapGroupSearchBase || '',
      localFallback: parseBoolean(CONFIG.ldapLocalFallback)
    },
    https: {
      enabled: parseBoolean(CONFIG.httpsEnabled),
      keyPath: CONFIG.httpsKeyPath || '',
      certPath: CONFIG.httpsCertPath || ''
    }
  };
}

function applySystemConfig(configPayload) {
  if (!configPayload || typeof configPayload !== 'object') return;
  const ldap = configPayload.ldap || {};
  const https = configPayload.https || {};

  if ('enabled' in ldap) CONFIG.ldapEnabled = parseBoolean(ldap.enabled);
  if ('log' in ldap) CONFIG.logLdap = parseBoolean(ldap.log);
  if ('url' in ldap) CONFIG.ldapUrl = normalizeSystemConfigValue(ldap.url, CONFIG.ldapUrl);
  if ('bindDn' in ldap) CONFIG.ldapBindDn = normalizeSystemConfigValue(ldap.bindDn, CONFIG.ldapBindDn);
  if ('baseDn' in ldap) CONFIG.ldapBaseDn = normalizeSystemConfigValue(ldap.baseDn, CONFIG.ldapBaseDn);
  if ('userFilter' in ldap) CONFIG.ldapUserFilter = normalizeSystemConfigValue(ldap.userFilter, CONFIG.ldapUserFilter);
  if ('requiredGroupDn' in ldap) CONFIG.ldapRequiredGroup = normalizeSystemConfigValue(ldap.requiredGroupDn, CONFIG.ldapRequiredGroup);
  if ('groupSearchBase' in ldap) CONFIG.ldapGroupSearchBase = normalizeSystemConfigValue(ldap.groupSearchBase, CONFIG.ldapGroupSearchBase);
  if ('localFallback' in ldap) CONFIG.ldapLocalFallback = parseBoolean(ldap.localFallback);
  if ('bindPassword' in ldap) {
    CONFIG.ldapBindPassword = normalizeSystemConfigValue(ldap.bindPassword, '');
  }

  if ('enabled' in https) CONFIG.httpsEnabled = parseBoolean(https.enabled);
  if ('keyPath' in https) CONFIG.httpsKeyPath = normalizeSystemConfigValue(https.keyPath, CONFIG.httpsKeyPath);
  if ('certPath' in https) CONFIG.httpsCertPath = normalizeSystemConfigValue(https.certPath, CONFIG.httpsCertPath);
}

function readSystemConfig() {
  try {
    const filePath = getSystemConfigFilePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn('Unable to read system config:', err.message);
    return null;
  }
}

function writeSystemConfig(configPayload) {
  const filePath = getSystemConfigFilePath();
  atomicWrite(filePath, configPayload);
}

const storedSystemConfig = readSystemConfig();
if (storedSystemConfig) {
  applySystemConfig(storedSystemConfig);
}

function getLdapConfigSnapshot() {
  return {
    enabled: CONFIG.ldapEnabled,
    log: CONFIG.logLdap,
    url: CONFIG.ldapUrl,
    bindDn: CONFIG.ldapBindDn,
    bindPasswordSet: !!CONFIG.ldapBindPassword,
    baseDn: CONFIG.ldapBaseDn,
    userFilter: CONFIG.ldapUserFilter,
    requiredGroupDn: CONFIG.ldapRequiredGroup,
    groupSearchBase: CONFIG.ldapGroupSearchBase,
    localFallback: CONFIG.ldapLocalFallback
  };
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

function getHttpsConfigSnapshot() {
  return {
    enabled: CONFIG.httpsEnabled,
    keyPath: CONFIG.httpsKeyPath,
    certPath: CONFIG.httpsCertPath
  };
}

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

function createUserSession(userName) {
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  userSessions.set(token, {
    userName,
    createdAt: new Date().toISOString()
  });
  return token;
}

function getUserToken(req) {
  return req.headers['x-user-token'] || req.body?.userToken || null;
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

  const session = userSessions.get(token);
  if (!session || session.userName !== normalizedUserName) {
    errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
    return false;
  }

  if (req.body && typeof req.body === 'object') {
    req.body.userName = normalizedUserName;
  }

  return true;
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Admin authentication required');
  }
  const token = authHeader.substring(7);
  if (!isValidAdminToken(token)) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired admin token');
  }
  next();
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

function validateExistingDepartments() {
  try {
    const files = fs.readdirSync(PATHS.departments);
    files.forEach(file => {
      if (!isDepartmentFile(file)) return;
      const deptName = file.replace('.json', '');
      const { data, error } = readDepartmentData(deptName);
      if (error) {
        console.warn(`Invalid JSON for department ${deptName}:`, error.message);
        return;
      }
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
    settings: !!modules.settings,
    integrations: !!modules.integrations
  };
}

function hasSelectedModules(modules) {
  return Object.values(modules).some(Boolean);
}

function isOnlyDepartments(modules) {
  return modules.departments && !modules.users && !modules.settings && !modules.integrations;
}

function collectDepartmentBackups() {
  ensureDataDir();
  const files = fs.readdirSync(PATHS.departments);
  const departments = [];

  for (const file of files) {
    if (!isDepartmentFile(file)) continue;
    const deptName = file.replace('.json', '');
    const { data, error } = readDepartmentData(deptName);
    if (error) {
      console.warn(`Skipping invalid JSON for department ${deptName}:`, error.message);
      continue;
    }
    if (!data) continue;
    departments.push({
      name: deptName,
      data
    });
  }

  return departments;
}

function buildLegacyBackup() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    serverConfig: {
      lockTimeoutMinutes: CONFIG.lockTimeoutMinutes,
      adminSessionTtlHours: CONFIG.adminSessionTtlHours,
      maxUploadBytes: CONFIG.maxUploadBytes,
      enableBak: CONFIG.enableBak
    },
    adminCredentials: {
      adminUser: CONFIG.adminUser
    },
    departments: collectDepartmentBackups()
  };
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
          serverConfig: {
            lockTimeoutMinutes: CONFIG.lockTimeoutMinutes,
            adminSessionTtlHours: CONFIG.adminSessionTtlHours,
            maxUploadBytes: CONFIG.maxUploadBytes,
            enableBak: CONFIG.enableBak
          },
          adminCredentials: {
            adminUser: CONFIG.adminUser
          }
        }
      } : { data: null },
      integrations: modules.integrations ? { data: [] } : { data: null }
    }
  };
}

function applyImportedSettings(payload = {}) {
  const serverConfig = payload.serverConfig || {};
  const adminCredentials = payload.adminCredentials || {};
  const applied = {};

  if (typeof serverConfig.lockTimeoutMinutes === 'number') {
    CONFIG.lockTimeoutMinutes = serverConfig.lockTimeoutMinutes;
    applied.lockTimeoutMinutes = CONFIG.lockTimeoutMinutes;
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
    CONFIG.adminUser = adminCredentials.adminUser.trim();
    applied.adminUser = CONFIG.adminUser;
  }

  return applied;
}

function importDepartmentsBackup(departments, overwriteExisting) {
  const results = {
    imported: [],
    skipped: [],
    errors: []
  };

  ensureDataDir();

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

    const filePath = getDepartmentFilePath(normalized);
    if (fs.existsSync(filePath) && !overwriteExisting) {
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

app.get('/api/departments', (req, res) => {
  try {
    ensureDataDir();
    const files = fs.readdirSync(PATHS.departments);
    const departments = [];
    for (const file of files) {
      if (!isDepartmentFile(file)) continue;
      const deptName = file.replace('.json', '');
      const { data, error } = readDepartmentData(deptName);
      if (error) {
        console.warn(`Skipping invalid JSON for department ${deptName}:`, error.message);
        continue;
      }
      if (!data) continue;
      departments.push({
        name: deptName,
        protected: !!(data.password && data.password.trim()),
        needsPasswordSetup: false,
        readOnly: false
      });
    }
    res.json({ departments });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list departments');
  }
});

app.post('/api/departments', requireAdmin, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return errorResponse(res, 400, 'INVALID_NAME', 'Department name is required');
    }
    const normalized = normalizeDepartmentName(name);
    if (!normalized) {
      return errorResponse(res, 400, 'INVALID_NAME', 'Invalid department name');
    }
    const filePath = getDepartmentFilePath(normalized);
    if (fs.existsSync(filePath)) {
      return errorResponse(res, 409, 'ALREADY_EXISTS', 'Department already exists');
    }
    const data = {
      password: null,
      projects: [],
      meta: {
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
        revision: 1
      }
    };
    writeDepartmentData(normalized, data);
    res.json({ name: normalized });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.delete('/api/departments/:name', requireAdmin, (req, res) => {
  try {
    const { name } = req.params;
    const filePath = getDepartmentFilePath(name);
    if (!filePath || !fs.existsSync(filePath)) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Department not found');
    }
    lockStore.remove(name);
    fs.unlinkSync(filePath);
    const bakPath = filePath + '.bak';
    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
    }
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/departments/:name/verify', (req, res) => {
  try {
    const { name } = req.params;
    const { password } = req.body;
    const data = getDepartmentDataOrRespond(res, name);
    if (!data) return;
    if (!data.password || !data.password.trim()) {
      return res.json({ ok: true });
    }
    if (data.password === password) {
      return res.json({ ok: true });
    }
    return res.status(401).json({
      ok: false,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password' }
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/departments/:name/change-password', (req, res) => {
  try {
    const { name } = req.params;
    const { oldPassword, newPassword } = req.body;
    const data = getDepartmentDataOrRespond(res, name);
    if (!data) return;
    if (typeof newPassword !== 'string') {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'newPassword is required');
    }
    const isSetupMode = !data.password || !data.password.trim();
    if (!isSetupMode) {
      if (data.password !== oldPassword) {
        return errorResponse(res, 401, 'INVALID_PASSWORD', 'Invalid old password');
      }
    }
    data.password = newPassword.trim() ? newPassword : null;
    data.meta.updatedAt = new Date().toISOString();
    data.meta.updatedBy = 'password_change';
    data.meta.revision = (data.meta.revision || 0) + 1;
    writeDepartmentData(name, data);
    res.json({ ok: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/departments/:name/reset-password', requireAdmin, (req, res) => {
  try {
    const { name } = req.params;
    const { newPassword } = req.body;
    const data = getDepartmentDataOrRespond(res, name);
    if (!data) return;
    data.password = newPassword || null;
    data.meta.updatedAt = new Date().toISOString();
    data.meta.updatedBy = 'admin';
    data.meta.revision = (data.meta.revision || 0) + 1;
    writeDepartmentData(name, data);
    res.json({ ok: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/projects/:department', (req, res) => {
  try {
    const { department } = req.params;
    const data = getDepartmentDataOrRespond(res, department);
    if (!data) return;
    const validationErrors = validateDepartmentData(data);
    res.json({
      projects: data.projects || [],
      meta: data.meta || { updatedAt: new Date().toISOString(), updatedBy: 'system', revision: 1 },
      validationErrors
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/departments/:name/export', (req, res) => {
  try {
    const { name } = req.params;
    const data = getDepartmentDataOrRespond(res, name);
    if (!data) return;
    const validationErrors = validateDepartmentData(data);
    res.json({ data, validationErrors });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/departments/:name/import', (req, res) => {
  try {
    const { name } = req.params;
    const { data, userName } = req.body;
    if (!data || typeof data !== 'object') {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'data is required');
    }
    if (!validateUserSession(req, res, userName)) {
      return;
    }
    cleanExpiredLocks();
    if (!isLockOwner(name, userName)) {
      const lockInfo = getLockInfo(name);
      if (lockInfo.locked) {
        return res.status(423).json(lockInfo);
      } else {
        return errorResponse(res, 423, 'LOCK_REQUIRED', 'Lock required to import');
      }
    }
    const errors = validateDepartmentData(data);
    if (errors.length > 0) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid department data', { errors });
    }
    data.meta = {
      updatedAt: new Date().toISOString(),
      updatedBy: userName,
      revision: (data.meta?.revision || 0) + 1
    };
    writeDepartmentData(name, data);
    res.json({ ok: true, meta: data.meta });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/projects/:department', (req, res) => {
  try {
    const { department } = req.params;
    const { projects, expectedRevision, userName } = req.body;
    if (expectedRevision === undefined || expectedRevision === null) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'expectedRevision is required');
    }
    if (!validateUserSession(req, res, userName)) {
      return;
    }
    cleanExpiredLocks();
    if (!isLockOwner(department, userName)) {
      const lockInfo = getLockInfo(department);
      if (lockInfo.locked) {
        return res.status(423).json(lockInfo);
      } else {
        return errorResponse(res, 423, 'LOCK_REQUIRED', 'Lock required to save');
      }
    }
    const data = getDepartmentDataOrRespond(res, department);
    if (!data) return;
    const currentRevision = data.meta?.revision || 0;
    if (currentRevision !== expectedRevision) {
      return res.status(409).json({
        error: {
          code: 'REVISION_MISMATCH',
          message: 'Data has been updated by another user',
          details: { expectedRevision, currentRevision }
        },
        currentRevision,
        meta: data.meta
      });
    }
    const validationData = { ...data, projects };
    const errors = validateDepartmentData(validationData);
    if (errors.length > 0) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid project data', { errors });
    }
    data.projects = projects;
    data.meta = {
      updatedAt: new Date().toISOString(),
      updatedBy: userName || 'unknown',
      revision: currentRevision + 1
    };
    writeDepartmentData(department, data);
    res.json({ ok: true, meta: data.meta });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.maxUploadBytes },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

app.post('/api/upload/:department', upload.single('file'), (req, res) => {
  try {
    const { department } = req.params;
    cleanExpiredLocks();
    const userName = req.body.userName || 'unknown';
    if (!validateUserSession(req, res, userName)) {
      return;
    }
    if (!isLockOwner(department, userName)) {
      const lockInfo = getLockInfo(department);
      if (lockInfo.locked) {
        return res.status(423).json(lockInfo);
      } else {
        return errorResponse(res, 423, 'LOCK_REQUIRED', 'Lock required to upload');
      }
    }
    if (!req.file) {
      return errorResponse(res, 400, 'NO_FILE', 'No file uploaded');
    }
    let uploadedData;
    try {
      uploadedData = JSON.parse(req.file.buffer.toString('utf8'));
    } catch (err) {
      return errorResponse(res, 400, 'INVALID_JSON', 'Invalid JSON file');
    }
    const errors = validateDepartmentData(uploadedData);
    if (errors.length > 0) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid data schema', { errors });
    }
    const data = getDepartmentDataOrRespond(res, department);
    if (!data) return;
    data.projects = uploadedData.projects || [];
    data.meta = {
      updatedAt: new Date().toISOString(),
      updatedBy: userName,
      revision: (data.meta?.revision || 0) + 1
    };
    writeDepartmentData(department, data);
    res.json({ ok: true, meta: data.meta });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'FILE_TOO_LARGE', 'File size exceeds limit');
    }
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/acquire', (req, res) => {
  try {
    const { department } = req.params;
    const { userName, clientHost } = req.body;
    if (!validateUserSession(req, res, userName)) {
      return;
    }
    cleanExpiredLocks();
    const existing = lockStore.get(department);
    if (existing && existing.ownerUserName !== userName) {
      const lockInfo = getLockInfo(department);
      return res.status(423).json(lockInfo);
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIG.lockTimeoutMinutes * 60 * 1000);
    const nextLock = {
      department,
      ownerUserName: userName,
      ownerType: req.body.ownerType || 'user',
      clientHost: clientHost || null,
      lockedAt: existing ? existing.lockedAt : now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastHeartbeatAt: now.toISOString()
    };
    lockStore.set(department, nextLock);
    res.json({
      locked: true,
      department,
      lockedBy: userName,
      ownerUserName: nextLock.ownerUserName,
      ownerType: nextLock.ownerType,
      lockedAt: nextLock.lockedAt,
      expiresAt: expiresAt.toISOString(),
      clientHost: nextLock.clientHost,
      lastHeartbeatAt: nextLock.lastHeartbeatAt
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/release', (req, res) => {
  try {
    const { department } = req.params;
    const { userName } = req.body;
    const lock = lockStore.get(department);
    if (lock && lock.ownerUserName === userName) {
      lockStore.remove(department);
    }
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/lock/:department/status', (req, res) => {
  try {
    const { department } = req.params;
    const lockInfo = getLockInfo(department);
    res.json(lockInfo);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/heartbeat', (req, res) => {
  try {
    const { department } = req.params;
    const { userName } = req.body;
    if (!validateUserSession(req, res, userName)) {
      return;
    }
    cleanExpiredLocks();
    const lock = lockStore.get(department);
    if (!lock || lock.ownerUserName !== userName) {
      return errorResponse(res, 409, 'LOCK_NOT_OWNED', 'Lock not owned by user');
    }
    const expiresAt = new Date(Date.now() + CONFIG.lockTimeoutMinutes * 60 * 1000);
    lockStore.set(department, {
      ...lock,
      expiresAt: expiresAt.toISOString(),
      lastHeartbeatAt: new Date().toISOString()
    });
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/admin-release', requireAdmin, (req, res) => {
  try {
    const { department } = req.params;
    lockStore.remove(department);
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/auth/config', (req, res) => {
  try {
    const snapshot = userStore.getAuthSnapshot();
    res.json({
      ldapEnabled: CONFIG.ldapEnabled,
      localFallback: CONFIG.ldapLocalFallback,
      localUsers: snapshot.localUsers
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password, department } = req.body;
    if (!userId || typeof userId !== 'string') {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'userId is required');
    }
    if (userId.trim() === CONFIG.adminUser) {
      return errorResponse(res, 403, 'ADMIN_LOCAL_ONLY', 'Admin access is local only');
    }

    const normalizedUserId = userId.trim();
    const ldapConfig = getLdapConfigForAuth();

    if (CONFIG.ldapEnabled) {
      const ldapResult = await authenticateLdapUser({ userId: normalizedUserId, password }, ldapConfig);
      if (ldapResult.ok) {
        const storeResult = userStore.upsertLdapUser(normalizedUserId, {
          displayName: ldapResult.profile.displayName,
          mail: ldapResult.profile.mail,
          department: ldapResult.profile.department || department || null
        });
        const userToken = createUserSession(normalizedUserId);
        return res.json({
          ok: true,
          authType: 'ldap',
          token: userToken,
          user: {
            userId: normalizedUserId,
            type: 'ad',
            displayName: storeResult.user.displayName,
            mail: storeResult.user.mail,
            department: storeResult.user.department
          }
        });
      }

      if (ldapResult.code === 'GROUP_REQUIRED') {
        return errorResponse(res, 403, ldapResult.code, ldapResult.message);
      }

      if (CONFIG.ldapLocalFallback && ldapResult.code !== 'GROUP_REQUIRED') {
        const localResult = userStore.verifyLocalUser(normalizedUserId, password);
        if (localResult.ok) {
          const userToken = createUserSession(normalizedUserId);
          return res.json({
            ok: true,
            authType: 'local',
            token: userToken,
            user: {
              userId: normalizedUserId,
              type: 'local',
              displayName: localResult.user.displayName || normalizedUserId,
              mail: localResult.user.mail || null,
              department: localResult.user.department || null
            }
          });
        }
      }

      const statusCode = ldapResult.code === 'LDAP_DOWN'
        ? 503
        : ldapResult.code === 'LDAP_CONFIG_ERROR'
          ? 500
          : 401;
      return errorResponse(res, statusCode, ldapResult.code, ldapResult.message);
    }

    const localResult = userStore.verifyLocalUser(normalizedUserId, password);
    if (!localResult.ok) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    const userToken = createUserSession(normalizedUserId);
    return res.json({
      ok: true,
      authType: 'local',
      token: userToken,
      user: {
        userId: normalizedUserId,
        type: 'local',
        displayName: localResult.user.displayName || normalizedUserId,
        mail: localResult.user.mail || null,
        department: localResult.user.department || null
      }
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { userId, password } = req.body;
    if (userId !== CONFIG.adminUser) {
      return errorResponse(res, 401, 'INVALID_USER', 'Invalid admin user');
    }
    if (password !== CONFIG.adminPassword) {
      return errorResponse(res, 401, 'INVALID_PASSWORD', 'Invalid admin password');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CONFIG.adminSessionTtlHours * 60 * 60 * 1000);
    adminTokens.set(token, {
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    const userToken = createUserSession(userId);
    res.json({ token, userToken });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);
    adminTokens.delete(token);
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/reset-password', (req, res) => {
  try {
    const { resetCode, newPassword } = req.body;
    if (!CONFIG.adminResetCode) {
      return errorResponse(res, 403, 'RESET_DISABLED', 'Password reset is not enabled. Set ONLYGANTT_ADMIN_RESET_CODE environment variable.');
    }
    if (!resetCode || resetCode !== CONFIG.adminResetCode) {
      return errorResponse(res, 401, 'INVALID_RESET_CODE', 'Invalid reset code');
    }
    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 400, 'INVALID_PASSWORD', 'Password must be at least 6 characters');
    }
    CONFIG.adminPassword = newPassword;
    adminTokens.clear();
    res.json({ ok: true, message: 'Admin password updated successfully' });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || oldPassword !== CONFIG.adminPassword) {
      return errorResponse(res, 401, 'INVALID_PASSWORD', 'Current password is incorrect');
    }
    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 400, 'INVALID_NEW_PASSWORD', 'New password must be at least 6 characters');
    }
    CONFIG.adminPassword = newPassword;
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    for (const [token] of adminTokens) {
      if (token !== currentToken) {
        adminTokens.delete(token);
      }
    }
    res.json({ ok: true, message: 'Admin password changed successfully' });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/ldap/test', requireAdmin, async (req, res) => {
  try {
    const { config, testUserId } = req.body || {};
    const baseConfig = getLdapConfigForAuth();
    const mergedConfig = { ...baseConfig, ...(config || {}) };
    const result = await testLdapConnection({
      configOverride: mergedConfig,
      testUserId: testUserId || null
    });
    if (!result.ok) {
      const statusCode = result.code === 'LDAP_DOWN' ? 503 : 400;
      return errorResponse(res, statusCode, result.code || 'LDAP_TEST_FAILED', result.message || 'LDAP test failed', result.details || null);
    }
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/admin/system-config', requireAdmin, (req, res) => {
  try {
    res.json({
      ldap: getLdapConfigSnapshot(),
      https: getHttpsConfigSnapshot()
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/admin/system-status', requireAdmin, (req, res) => {
  try {
    const memory = process.memoryUsage();
    res.json({
      ok: true,
      app: {
        name: packageInfo.name || 'OnlyGANTT',
        version: packageInfo.version || 'dev'
      },
      server: {
        status: 'online',
        startedAt: SERVER_STARTED_AT,
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        cpuCount: os.cpus()?.length || 0,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        memoryRss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal
      }
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/system-config', requireAdmin, (req, res) => {
  try {
    const payload = req.body || {};
    const ldapPayload = payload.ldap || {};
    const httpsPayload = payload.https || {};

    const currentConfig = getSystemConfigState();
    const nextConfig = {
      ldap: { ...currentConfig.ldap },
      https: { ...currentConfig.https }
    };

    if ('enabled' in ldapPayload) nextConfig.ldap.enabled = parseBoolean(ldapPayload.enabled);
    if ('log' in ldapPayload) nextConfig.ldap.log = parseBoolean(ldapPayload.log);
    if ('url' in ldapPayload) nextConfig.ldap.url = normalizeSystemConfigValue(ldapPayload.url, currentConfig.ldap.url);
    if ('bindDn' in ldapPayload) nextConfig.ldap.bindDn = normalizeSystemConfigValue(ldapPayload.bindDn, currentConfig.ldap.bindDn);
    if ('baseDn' in ldapPayload) nextConfig.ldap.baseDn = normalizeSystemConfigValue(ldapPayload.baseDn, currentConfig.ldap.baseDn);
    if ('userFilter' in ldapPayload) nextConfig.ldap.userFilter = normalizeSystemConfigValue(ldapPayload.userFilter, currentConfig.ldap.userFilter);
    if ('requiredGroupDn' in ldapPayload) nextConfig.ldap.requiredGroupDn = normalizeSystemConfigValue(ldapPayload.requiredGroupDn, currentConfig.ldap.requiredGroupDn);
    if ('groupSearchBase' in ldapPayload) nextConfig.ldap.groupSearchBase = normalizeSystemConfigValue(ldapPayload.groupSearchBase, currentConfig.ldap.groupSearchBase);
    if ('localFallback' in ldapPayload) nextConfig.ldap.localFallback = parseBoolean(ldapPayload.localFallback);
    if ('bindPassword' in ldapPayload) {
      if (ldapPayload.bindPassword !== null) {
        nextConfig.ldap.bindPassword = normalizeSystemConfigValue(ldapPayload.bindPassword, currentConfig.ldap.bindPassword);
      }
    }

    if ('enabled' in httpsPayload) nextConfig.https.enabled = parseBoolean(httpsPayload.enabled);
    if ('keyPath' in httpsPayload) nextConfig.https.keyPath = normalizeSystemConfigValue(httpsPayload.keyPath, currentConfig.https.keyPath);
    if ('certPath' in httpsPayload) nextConfig.https.certPath = normalizeSystemConfigValue(httpsPayload.certPath, currentConfig.https.certPath);

    writeSystemConfig(nextConfig);
    applySystemConfig(nextConfig);

    res.json({
      ok: true,
      ldap: getLdapConfigSnapshot(),
      https: getHttpsConfigSnapshot()
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const storedUsers = userStore.listUsers();
    let ldapUsers = [];
    let ldapError = null;

    if (CONFIG.ldapEnabled) {
      try {
        const ldapResult = await listLdapUsers(getLdapConfigForAuth());
        if (ldapResult.ok) {
          ldapUsers = ldapResult.users || [];
          ldapUsers.forEach((user) => {
            if (!user?.userId) return;
            userStore.upsertLdapUser(
              user.userId,
              {
                displayName: user.displayName,
                mail: user.mail,
                department: user.department || null
              },
              { touchLoginAt: false }
            );
          });
        } else {
          ldapError = {
            code: ldapResult.code || 'LDAP_ERROR',
            message: ldapResult.message || 'LDAP search failed'
          };
        }
      } catch (err) {
        ldapError = {
          code: err?.code || 'LDAP_ERROR',
          message: err?.message || 'LDAP search failed'
        };
      }
    }

    const mergedUsers = new Map();
    storedUsers.forEach((user) => {
      const key = (user.userId || '').toLowerCase();
      if (key) {
        mergedUsers.set(key, user);
      }
    });
    ldapUsers.forEach((user) => {
      const key = (user.userId || '').toLowerCase();
      if (!key) return;
      if (!mergedUsers.has(key)) {
        mergedUsers.set(key, user);
      }
    });

    res.json({
      users: Array.from(mergedUsers.values()),
      ldapEnabled: CONFIG.ldapEnabled,
      ldapError
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/admin/departments', requireAdmin, (req, res) => {
  try {
    ensureDataDir();
    const files = fs.readdirSync(PATHS.departments);
    const departments = [];
    for (const file of files) {
      if (!isDepartmentFile(file)) continue;
      const deptName = file.replace('.json', '');
      try {
        const { data, error } = readDepartmentData(deptName);
        if (error) {
          console.warn(`Skipping invalid JSON for department ${deptName}:`, error.message);
          continue;
        }
        if (!data) continue;
        departments.push({
          name: deptName,
          file: file,
          protected: !!(data.password && data.password.trim()),
          needsPasswordSetup: false,
          meta: data.meta,
          lock: getLockInfo(deptName)
        });
      } catch (err) {
        console.warn(`Error reading department ${deptName}:`, err.message);
      }
    }
    res.json({ departments });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/server-restart', requireAdmin, (req, res) => {
  try {
    logAuditEvent({
      eventType: 'SERVER_RESTART',
      actor: CONFIG.adminUser,
      ip: req.ip,
      logDir: PATHS.logs,
      details: {
        userAgent: req.headers['user-agent'] || null
      }
    });
    res.json({ ok: true });
    setTimeout(() => {
      try {
        restartServer();
      } catch (err) {
        console.error(`Restart failed: ${err.message}`);
      }
    }, 250);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.get('/api/admin/server-backup', requireAdmin, (req, res) => {
  try {
    const backup = buildLegacyBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="onlygantt-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/server-restore', requireAdmin, (req, res) => {
  try {
    const { backup, overwriteExisting = false } = req.body;

    if (!backup || typeof backup !== 'object') {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'backup data is required');
    }

    if (!backup.departments || !Array.isArray(backup.departments)) {
      return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: departments array missing');
    }

    const results = importDepartmentsBackup(backup.departments, overwriteExisting);

    res.json({
      ok: true,
      results,
      summary: {
        total: backup.departments.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      }
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/export', requireAdmin, (req, res) => {
  try {
    const modules = normalizeModules(req.body?.modules);
    if (!hasSelectedModules(modules)) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'At least one module must be selected');
    }

    const backup = isOnlyDepartments(modules)
      ? buildLegacyBackup()
      : buildModularBackup(modules);

    res.json(backup);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/admin/import', requireAdmin, (req, res) => {
  try {
    const { backup, overwriteExisting = false } = req.body;
    const modules = normalizeModules(req.body?.modules);

    if (!backup || typeof backup !== 'object') {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'backup data is required');
    }

    if (!hasSelectedModules(modules)) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'At least one module must be selected');
    }

    let departmentPayload = null;
    let userPayload = null;
    let settingsPayload = null;

    if (modules.departments) {
      if (Array.isArray(backup.departments)) {
        departmentPayload = backup.departments;
      } else if (Array.isArray(backup.modules?.departments?.data)) {
        departmentPayload = backup.modules.departments.data;
      } else {
        return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: departments data missing');
      }
    }

    if (modules.users) {
      if (Array.isArray(backup.modules?.users?.data)) {
        userPayload = backup.modules.users.data;
      } else if (Array.isArray(backup.users)) {
        userPayload = backup.users;
      } else {
        return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: users data missing');
      }
    }

    if (modules.settings) {
      if (backup.modules?.settings?.data) {
        settingsPayload = backup.modules.settings.data;
      } else if (backup.serverConfig || backup.adminCredentials) {
        settingsPayload = {
          serverConfig: backup.serverConfig || {},
          adminCredentials: backup.adminCredentials || {}
        };
      } else {
        return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: settings data missing');
      }
    }

    const results = {};
    let summary = {
      totalDepartments: departmentPayload ? departmentPayload.length : 0,
      totalUsers: userPayload ? userPayload.length : 0,
      imported: 0,
      skipped: 0,
      errors: 0
    };

    if (modules.departments) {
      const departmentResults = importDepartmentsBackup(departmentPayload, overwriteExisting);
      results.departments = departmentResults;
      summary = {
        ...summary,
        imported: departmentResults.imported.length,
        skipped: departmentResults.skipped.length,
        errors: departmentResults.errors.length
      };
    } else {
      results.departments = { skipped: true, reason: 'Module disabled' };
    }

    if (modules.users) {
      const userResults = userStore.importUsers(userPayload, overwriteExisting);
      results.users = userResults;
      summary = {
        ...summary,
        imported: summary.imported + userResults.imported.length,
        skipped: summary.skipped + userResults.skipped.length,
        errors: summary.errors + userResults.errors.length
      };
    } else {
      results.users = { skipped: true, reason: 'Module disabled' };
    }

    if (modules.settings) {
      const applied = applyImportedSettings(settingsPayload);
      results.settings = { applied };
      summary = {
        ...summary,
        imported: summary.imported + (Object.keys(applied).length > 0 ? 1 : 0)
      };
    } else {
      results.settings = { skipped: true, reason: 'Module disabled' };
    }

    const unsupportedReason = 'Module not supported yet';
    results.integrations = modules.integrations ? { skipped: true, reason: unsupportedReason } : { skipped: true, reason: 'Module disabled' };

    res.json({
      ok: true,
      results,
      summary
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

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
