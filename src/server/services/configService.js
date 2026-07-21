const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isValidHashedSecret, HASHED_SECRET_ALGORITHM } = require('../schema');

const DEFAULT_ADMIN_USER = 'admin';
const SYSTEM_CONFIG_FILE = 'system-config.json';
const SYSTEM_CONFIG_LOCAL_FILE = 'system-config.local.json';
const ADMIN_AUTH_CONFIG_FILE = 'admin-auth.json';

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveRepoPath(repoRoot, targetPath, fallbackRelativePath) {
  const candidate = targetPath || fallbackRelativePath;
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.resolve(repoRoot, candidate);
}

function createConfigService({ repoRoot, dataDirOverride, processEnv = process.env }) {
  const dataDir = resolveRepoPath(repoRoot, dataDirOverride || processEnv.ONLYGANTT_DATA_DIR || processEnv.DATA_DIR, 'Data');

  const CONFIG = {
    port: parseNumber(processEnv.PORT, 3000),
    dataDir,
    enableBak: parseBoolean(processEnv.ONLYGANTT_ENABLE_BAK ?? true),
    lockTimeoutMinutes: parseNumber(processEnv.ONLYGANTT_LOCK_TIMEOUT_MINUTES, 60),
    userSessionTtlHours: parseNumber(processEnv.ONLYGANTT_USER_SESSION_TTL_HOURS, 8),
    adminSessionTtlHours: parseNumber(processEnv.ONLYGANTT_ADMIN_TTL_HOURS, 8),
    maxUploadBytes: parseNumber(processEnv.ONLYGANTT_MAX_UPLOAD_BYTES, 2000000),
    adminUser: processEnv.ONLYGANTT_ADMIN_USER || DEFAULT_ADMIN_USER,
    adminResetCode: processEnv.ONLYGANTT_ADMIN_RESET_CODE || null,
    ldapEnabled: parseBoolean(processEnv.LDAP_ENABLED),
    logLdap: parseBoolean(processEnv.LOG_LDAP),
    ldapUrl: processEnv.LDAP_URL || '',
    ldapBindDn: processEnv.LDAP_BIND_DN || '',
    ldapBindPassword: processEnv.LDAP_BIND_PASSWORD || '',
    ldapBaseDn: processEnv.LDAP_BASE_DN || '',
    ldapUserFilter: processEnv.LDAP_USER_FILTER || '(sAMAccountName={{username}})',
    ldapRequiredGroup: processEnv.LDAP_REQUIRED_GROUP || '',
    ldapGroupSearchBase: processEnv.LDAP_GROUP_SEARCH_BASE || '',
    ldapLocalFallback: parseBoolean(processEnv.LDAP_LOCAL_FALLBACK),
    httpsEnabled: parseBoolean(processEnv.HTTPS_ENABLED),
    httpsKeyPath: processEnv.HTTPS_KEY_PATH || '',
    httpsCertPath: processEnv.HTTPS_CERT_PATH || ''
  };

  const PATHS = {
    root: CONFIG.dataDir,
    departments: path.join(CONFIG.dataDir, 'reparti'),
    users: path.join(CONFIG.dataDir, 'utenti'),
    config: path.join(CONFIG.dataDir, 'config'),
    logs: path.join(CONFIG.dataDir, 'log')
  };

  const HAS_ENV_ADMIN_PASSWORD = typeof processEnv.ONLYGANTT_ADMIN_PASSWORD === 'string' && processEnv.ONLYGANTT_ADMIN_PASSWORD.length > 0;
  const HAS_ENV_ADMIN_USER = typeof processEnv.ONLYGANTT_ADMIN_USER === 'string' && processEnv.ONLYGANTT_ADMIN_USER.trim().length > 0;

  let adminAuthState = {
    source: 'unconfigured',
    adminUser: CONFIG.adminUser,
    passwordHash: null
  };

  function ensureDirectories() {
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
    ensureDirectories();
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

  function getSystemConfigFilePath() {
    ensureDirectories();
    return path.join(PATHS.config, SYSTEM_CONFIG_FILE);
  }

  function getSystemConfigLocalFilePath() {
    ensureDirectories();
    return path.join(PATHS.config, SYSTEM_CONFIG_LOCAL_FILE);
  }

  function getAdminAuthConfigFilePath() {
    ensureDirectories();
    return path.join(PATHS.config, ADMIN_AUTH_CONFIG_FILE);
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
      ? processEnv.ONLYGANTT_ADMIN_USER.trim()
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
      return password === processEnv.ONLYGANTT_ADMIN_PASSWORD;
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
    if (!normalizedAdminUser) return;
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

  function readSystemConfig() {
    const baseConfig = readJsonObjectFile(getSystemConfigFilePath(), 'system config');
    const localConfig = readJsonObjectFile(getSystemConfigLocalFilePath(), 'local system config');
    if (!baseConfig && !localConfig) return null;
    const mergedConfig = { ...(baseConfig || {}) };
    if (localConfig?.ldap && typeof localConfig.ldap === 'object') {
      mergedConfig.ldap = {
        ...(mergedConfig.ldap && typeof mergedConfig.ldap === 'object' ? mergedConfig.ldap : {}),
        ...localConfig.ldap
      };
    }
    return mergedConfig;
  }

  function normalizeSystemConfigValue(value, fallback = '') {
    if (value == null) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return fallback;
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

  function init() {
    ensureDirectories();
    const stored = readSystemConfig();
    if (stored) {
      applySystemConfig(stored);
    }
    refreshAdminAuthState();
  }

  return {
    CONFIG,
    PATHS,
    DEFAULT_ADMIN_USER,
    parseBoolean,
    parseNumber,
    hashSecret,
    verifyHashedSecret,
    normalizeNonEmptyString,
    atomicWrite,
    ensureDirectories,
    refreshAdminAuthState,
    isAdminConfigured,
    isAdminManagedByEnv,
    verifyAdminPassword,
    persistAdminPassword,
    persistAdminUser,
    getSystemConfigState,
    applySystemConfig,
    readSystemConfig,
    writeSystemConfig,
    normalizeSystemConfigValue,
    init
  };
}

module.exports = { createConfigService };
