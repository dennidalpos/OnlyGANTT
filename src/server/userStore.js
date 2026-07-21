const { DatabaseSync } = require('node:sqlite');
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return {
    algorithm: HASHED_SECRET_ALGORITHM,
    salt,
    hash
  };
}

function hasValidLocalPasswordHash(passwordHash) {
  return isValidHashedSecret(passwordHash);
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

function createUserStore({ dataDir, dbName = 'users.db', logger = console }) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, dbName);
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id_normalized TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);

  const ensureStore = () => {
    // Migration helper for legacy json user files into SQLite
    try {
      const files = fs.readdirSync(dataDir);
      for (const file of files) {
        if (file.endsWith('.json') && !file.endsWith('.tmp') && !file.endsWith('.bak')) {
          const filePath = path.join(dataDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            if (isValidUserRecord(data)) {
              const normId = data.userIdNormalized.toLowerCase();
              const existing = db.prepare('SELECT 1 FROM users WHERE user_id_normalized = ?').get(normId);
              if (!existing) {
                db.prepare('INSERT INTO users (user_id_normalized, user_id, data) VALUES (?, ?, ?)').run(
                  normId,
                  data.userId,
                  JSON.stringify(data)
                );
              }
            }
            fs.unlinkSync(filePath);
          } catch (_) {}
        }
      }
    } catch (_) {}
  };

  const readUserFile = (userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return null;
    try {
      const row = db.prepare('SELECT data FROM users WHERE user_id_normalized = ?').get(normalized.toLowerCase());
      if (!row) return null;
      const data = JSON.parse(row.data);
      return isValidUserRecord(data) ? data : null;
    } catch (err) {
      logger.error(`[UserStore] Error reading user ${userId}:`, err.message);
      return null;
    }
  };

  const writeUserFile = (userId, data) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) throw new Error('Invalid user id');
    const normId = normalized.toLowerCase();
    db.prepare('INSERT OR REPLACE INTO users (user_id_normalized, user_id, data) VALUES (?, ?, ?)').run(
      normId,
      data.userId,
      JSON.stringify(data)
    );
  };

  const readAllUsers = () => {
    try {
      const rows = db.prepare('SELECT data FROM users').all();
      const users = [];
      for (const row of rows) {
        try {
          const data = JSON.parse(row.data);
          if (isValidUserRecord(data)) users.push(data);
        } catch (_) {}
      }
      return users;
    } catch (err) {
      logger.error('[UserStore] Error reading all users:', err.message);
      return [];
    }
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
        departmentPermissions: user.departmentPermissions || {},
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
      departmentPermissions: user.departmentPermissions || {},
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

    const rawPassword = typeof payload.password === 'string' ? payload.password : null;
    let nextPassword = null;
    if (rawPassword !== null && rawPassword.trim() !== '') {
      if (rawPassword.trim().length < 6) {
        return { ok: false, code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters' };
      }
      nextPassword = rawPassword.trim();
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

    if (payload.departmentPermissions && typeof payload.departmentPermissions === 'object') {
      user.departmentPermissions = payload.departmentPermissions;
    }

    writeUserFile(normalized, user);
    return { ok: true, user, created: !existing };
  };

  const setUserDepartmentPermissions = (userId, permissions = {}) => {
    ensureStore();
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      return { ok: false, code: 'INVALID_USER', message: 'Invalid user id' };
    }

    let user = readUserFile(normalized);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        userId: normalized,
        userIdNormalized: normalized.toLowerCase(),
        type: 'ad',
        displayName: normalized,
        createdAt: now,
        lastLoginAt: null,
        loginHistory: [],
        departmentPermissions: {}
      };
    }

    user.departmentPermissions = permissions && typeof permissions === 'object' ? permissions : {};
    user.updatedAt = new Date().toISOString();
    writeUserFile(normalized, user);
    return { ok: true, userId: user.userId, departmentPermissions: user.departmentPermissions };
  };

  const getUserDepartmentPermissions = (userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return {};
    const user = readUserFile(normalized);
    return (user && user.departmentPermissions && typeof user.departmentPermissions === 'object')
      ? user.departmentPermissions
      : {};
  };

  const deleteLocalUser = (userId) => {
    ensureStore();
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      return { ok: false, code: 'NOT_FOUND', message: 'User not found' };
    }

    const user = readUserFile(normalized);
    if (!user) {
      return { ok: false, code: 'NOT_FOUND', message: 'User not found' };
    }
    if (user.type !== 'local') {
      return { ok: false, code: 'USER_TYPE_CONFLICT', message: 'Only local users can be deleted here' };
    }

    db.prepare('DELETE FROM users WHERE user_id_normalized = ?').run(normalized.toLowerCase());
    return { ok: true, userId: user.userId };
  };

  const close = () => {
    try {
      db.close();
    } catch (_) {}
  };

  return {
    ensureStore,
    verifyLocalUser,
    upsertLdapUser,
    upsertLocalUser,
    deleteLocalUser,
    setUserDepartmentPermissions,
    getUserDepartmentPermissions,
    getAuthSnapshot,
    listLocalUsers,
    listUsers,
    exportUsers,
    importUsers,
    close
  };
}

module.exports = {
  createUserStore
};
