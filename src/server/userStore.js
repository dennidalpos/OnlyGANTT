const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isValidHashedSecret, HASHED_SECRET_ALGORITHM } = require('./schema');

const RESERVED_WINDOWS_FILE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

function normalizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(trimmed)) return null;
  if (trimmed.includes('..')) return null;
  if (trimmed.endsWith('.')) return null;

  const normalizedUpper = trimmed.toUpperCase();
  const reservedCandidate = trimmed.split('.')[0].toUpperCase();
  if (RESERVED_WINDOWS_FILE_NAMES.has(normalizedUpper) || RESERVED_WINDOWS_FILE_NAMES.has(reservedCandidate)) {
    return null;
  }

  return trimmed;
}

const LEGACY_LOCAL_PASSWORD_REGEX = /^[a-f0-9]{64}$/i;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return {
    algorithm: HASHED_SECRET_ALGORITHM,
    salt,
    hash
  };
}

function hashLegacyPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

function isLegacyPasswordHash(passwordHash) {
  return typeof passwordHash === 'string' && LEGACY_LOCAL_PASSWORD_REGEX.test(passwordHash);
}

function hasValidLocalPasswordHash(passwordHash) {
  return isValidHashedSecret(passwordHash) || isLegacyPasswordHash(passwordHash);
}

function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || !password) {
    return false;
  }

  if (isValidHashedSecret(passwordHash)) {
    const actualHash = crypto.scryptSync(password, passwordHash.salt, 64);
    const expectedHash = Buffer.from(passwordHash.hash, 'hex');
    if (actualHash.length !== expectedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  if (isLegacyPasswordHash(passwordHash)) {
    return hashLegacyPassword(password) === passwordHash;
  }

  return false;
}

function normalizeOptionalString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isValidUserRecord(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  if (!normalizeUserId(data.userId) || !normalizeUserId(data.userIdNormalized)) {
    return false;
  }

  if (!['local', 'ad'].includes(data.type)) {
    return false;
  }

  if (data.type === 'local' && !hasValidLocalPasswordHash(data.passwordHash)) {
    return false;
  }

  return true;
}

function createUserStore({ dataDir, enableBak }) {
  const legacyUsersFilePath = path.join(dataDir, 'users.json');

  const ensureStore = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    migrateLegacyStore();
  };

  const getUserFilePath = (userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return null;
    return path.join(dataDir, `${normalized.toLowerCase()}.json`);
  };

  const readUserFile = (userId) => {
    const filePath = getUserFilePath(userId);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      if (!isValidUserRecord(data)) {
        console.warn(`[userStore] Invalid user file structure: ${path.basename(filePath)}`);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[userStore] Unable to read user file ${path.basename(filePath)}: ${err.message}`);
      return null;
    }
  };

  const writeUserFileAtPath = (filePath, data) => {
    const tmpPath = `${filePath}.tmp`;
    const bakPath = `${filePath}.bak`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    if (enableBak && fs.existsSync(filePath)) {
      if (fs.existsSync(bakPath)) {
        fs.unlinkSync(bakPath);
      }
      fs.copyFileSync(filePath, bakPath);
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.renameSync(tmpPath, filePath);
  };

  const writeUserFile = (userId, data) => {
    ensureStore();
    const filePath = getUserFilePath(userId);
    if (!filePath) {
      throw new Error('Invalid user id');
    }
    writeUserFileAtPath(filePath, data);
  };

  const migrateLegacyStore = () => {
    if (!fs.existsSync(legacyUsersFilePath)) return;
    try {
      const content = fs.readFileSync(legacyUsersFilePath, 'utf8');
      const data = JSON.parse(content);
      if (!data.users || !Array.isArray(data.users)) {
        return;
      }
      data.users.forEach((user) => {
        const normalized = normalizeUserId(user.userId || user.userIdNormalized);
        if (!normalized) return;
        const payload = {
          ...user,
          userId: user.userId || normalized,
          userIdNormalized: user.userIdNormalized || normalized.toLowerCase()
        };
        if (!isValidUserRecord(payload)) {
          return;
        }
        const userPath = path.join(dataDir, `${payload.userIdNormalized}.json`);
        if (!fs.existsSync(userPath)) {
          writeUserFileAtPath(userPath, payload);
        }
      });
      const migratedPath = `${legacyUsersFilePath}.migrated`;
      if (!fs.existsSync(migratedPath)) {
        fs.renameSync(legacyUsersFilePath, migratedPath);
      }
    } catch (err) {
      return;
    }
  };

  const listUserFiles = () => {
    ensureStore();
    return fs.readdirSync(dataDir)
      .filter((file) => file.endsWith('.json') && !file.endsWith('.tmp') && !file.endsWith('.bak'))
      .map((file) => path.join(dataDir, file));
  };

  const readAllUsers = () => {
    const files = listUserFiles();
    const users = [];
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        if (isValidUserRecord(data)) {
          users.push(data);
        }
      } catch (err) {
        continue;
      }
    }
    return users;
  };

  const verifyLocalUser = (userId, password) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return { ok: false, code: 'INVALID_CREDENTIALS' };
    const user = readUserFile(normalized);
    if (!user || user.type !== 'local') {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    const now = new Date().toISOString();
    if (isLegacyPasswordHash(user.passwordHash)) {
      user.passwordHash = hashPassword(password);
      user.passwordUpdatedAt = now;
    }
    user.lastLoginAt = now;
    const history = Array.isArray(user.loginHistory) ? user.loginHistory : [];
    history.push(now);
    user.loginHistory = history.slice(-50);
    writeUserFile(normalized, user);
    return { ok: true, user };
  };

  const upsertLdapUser = (userId, profile = {}, { touchLoginAt = true } = {}) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      return { ok: false, code: 'INVALID_USER' };
    }

    let user = readUserFile(normalized);
    const now = new Date().toISOString();
    let wasProvisioned = false;

    if (!user) {
      user = {
        userId: normalized,
        userIdNormalized: normalized.toLowerCase(),
        type: 'ad',
        displayName: profile.displayName || null,
        mail: profile.mail || null,
        department: profile.department || null,
        createdAt: now,
        lastLoginAt: touchLoginAt ? now : null,
        loginHistory: touchLoginAt ? [now] : [],
        ldapProvisionedAt: now
      };
      wasProvisioned = true;
    } else {
      if (user.type === 'ad') {
        user.displayName = profile.displayName || user.displayName || null;
        user.mail = profile.mail || user.mail || null;
        user.department = profile.department || user.department || null;
      }
      if (touchLoginAt) {
        user.lastLoginAt = now;
        const history = Array.isArray(user.loginHistory) ? user.loginHistory : [];
        history.push(now);
        user.loginHistory = history.slice(-50);
      }
      if (user.type === 'ad' && !user.ldapProvisionedAt) {
        user.ldapProvisionedAt = now;
        wasProvisioned = true;
      }
    }

    writeUserFile(normalized, user);
    return { ok: true, user, provisioned: wasProvisioned };
  };

  const getAuthSnapshot = () => {
    try {
      const data = readAllUsers();
      return {
        localUsers: data.filter((user) => user.type === 'local').length
      };
    } catch (err) {
      return { localUsers: 0 };
    }
  };

  const listLocalUsers = () => {
    const data = readAllUsers();
    return data
      .filter((user) => user.type === 'local')
      .map((user) => ({
        userId: user.userId,
        displayName: user.displayName || user.userId,
        mail: user.mail || null,
        department: user.department || null,
        userType: 'local',
        lastLoginAt: user.lastLoginAt || user.createdAt || null,
        loginHistory: Array.isArray(user.loginHistory) ? user.loginHistory : []
      }));
  };

  const listUsers = () => {
    const data = readAllUsers();
    return data.map((user) => ({
      userId: user.userId,
      displayName: user.displayName || user.userId,
      mail: user.mail || null,
      department: user.department || null,
      userType: user.type === 'ad' ? 'ad' : 'local',
      lastLoginAt: user.lastLoginAt || user.ldapProvisionedAt || user.createdAt || null,
      loginHistory: Array.isArray(user.loginHistory) ? user.loginHistory : []
    }));
  };

  const exportUsers = () => readAllUsers();

  const importUsers = (users, overwriteExisting) => {
    ensureStore();
    const results = {
      imported: [],
      skipped: [],
      errors: []
    };
    if (!Array.isArray(users)) {
      results.errors.push({ userId: null, error: 'Invalid users payload' });
      return results;
    }
    users.forEach((user) => {
      try {
        const normalized = normalizeUserId(user?.userId || user?.userIdNormalized);
        if (!normalized) {
          results.skipped.push({ userId: null, reason: 'Invalid user id' });
          return;
        }
        const normalizedId = normalized.toLowerCase();
        if (!overwriteExisting) {
          const existing = readUserFile(normalized);
          if (existing) {
            results.skipped.push({ userId: normalized, reason: 'User already exists' });
            return;
          }
        }
        const payload = {
          ...user,
          userId: normalized,
          userIdNormalized: normalizedId
        };
        if (!isValidUserRecord(payload)) {
          results.skipped.push({ userId: normalized, reason: 'Invalid user payload' });
          return;
        }
        writeUserFile(normalized, payload);
        results.imported.push(normalized);
      } catch (err) {
        results.errors.push({ userId: user?.userId || user?.userIdNormalized || null, error: err.message });
      }
    });
    return results;
  };

  const upsertLocalUser = (userId, payload = {}) => {
    ensureStore();
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      return { ok: false, code: 'INVALID_USER', message: 'Invalid user id' };
    }

    const nextPassword = typeof payload.password === 'string' ? payload.password : null;
    if (nextPassword !== null && nextPassword.length < 6) {
      return { ok: false, code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters' };
    }

    const existing = readUserFile(normalized);
    if (existing && existing.type !== 'local') {
      return { ok: false, code: 'USER_TYPE_CONFLICT', message: 'User exists as non-local account' };
    }

    if (!existing && !nextPassword) {
      return { ok: false, code: 'PASSWORD_REQUIRED', message: 'Password is required for new local users' };
    }

    const now = new Date().toISOString();
    const user = existing || {
      userId: normalized,
      userIdNormalized: normalized.toLowerCase(),
      type: 'local',
      createdAt: now,
      lastLoginAt: null,
      loginHistory: []
    };

    user.userId = normalized;
    user.userIdNormalized = normalized.toLowerCase();
    user.type = 'local';
    user.displayName = normalizeOptionalString(payload.displayName) || user.displayName || normalized;
    user.mail = normalizeOptionalString(payload.mail) || null;
    user.department = normalizeOptionalString(payload.department) || null;
    user.updatedAt = now;

    if (nextPassword) {
      user.passwordHash = hashPassword(nextPassword);
      user.passwordUpdatedAt = now;
    }

    if (!user.passwordHash) {
      return { ok: false, code: 'PASSWORD_REQUIRED', message: 'Password is required for local users' };
    }

    writeUserFile(normalized, user);
    return { ok: true, user, created: !existing };
  };

  const deleteLocalUser = (userId) => {
    ensureStore();
    const filePath = getUserFilePath(userId);
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, code: 'NOT_FOUND', message: 'User not found' };
    }

    const user = readUserFile(userId);
    if (!user) {
      return { ok: false, code: 'NOT_FOUND', message: 'User not found' };
    }
    if (user.type !== 'local') {
      return { ok: false, code: 'USER_TYPE_CONFLICT', message: 'Only local users can be deleted here' };
    }

    fs.unlinkSync(filePath);
    const bakPath = `${filePath}.bak`;
    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
    }
    return { ok: true, userId: user.userId };
  };

  return {
    ensureStore,
    verifyLocalUser,
    upsertLdapUser,
    upsertLocalUser,
    deleteLocalUser,
    getAuthSnapshot,
    listLocalUsers,
    listUsers,
    exportUsers,
    importUsers
  };
}

module.exports = {
  createUserStore
};
