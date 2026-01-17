const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed ? trimmed : null;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
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
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (!data.userId || !data.userIdNormalized) {
      throw new Error('Invalid user file structure');
    }
    return data;
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
        if (data.userId && data.userIdNormalized) {
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
    const expectedHash = user.passwordHash || '';
    if (!password || hashPassword(password) !== expectedHash) {
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
      if (touchLoginAt) {
        user.lastLoginAt = now;
        const history = Array.isArray(user.loginHistory) ? user.loginHistory : [];
        history.push(now);
        user.loginHistory = history.slice(-50);
      }
      if (user.type === 'ad' && !user.ldapProvisionedAt) {
        user.displayName = profile.displayName || user.displayName || null;
        user.mail = profile.mail || user.mail || null;
        user.department = profile.department || user.department || null;
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
        writeUserFile(normalized, payload);
        results.imported.push(normalized);
      } catch (err) {
        results.errors.push({ userId: user?.userId || user?.userIdNormalized || null, error: err.message });
      }
    });
    return results;
  };

  return {
    ensureStore,
    verifyLocalUser,
    upsertLdapUser,
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
