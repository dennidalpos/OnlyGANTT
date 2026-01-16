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
  const usersFilePath = path.join(dataDir, 'users.json');

  const ensureStore = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }, null, 2), 'utf8');
    }
  };

  const readStore = () => {
    ensureStore();
    const content = fs.readFileSync(usersFilePath, 'utf8');
    const data = JSON.parse(content);
    if (!data.users || !Array.isArray(data.users)) {
      throw new Error('Invalid users.json structure');
    }
    return data;
  };

  const writeStore = (data) => {
    ensureStore();
    const tmpPath = `${usersFilePath}.tmp`;
    const bakPath = `${usersFilePath}.bak`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    if (enableBak && fs.existsSync(usersFilePath)) {
      if (fs.existsSync(bakPath)) {
        fs.unlinkSync(bakPath);
      }
      fs.copyFileSync(usersFilePath, bakPath);
    }
    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
    fs.renameSync(tmpPath, usersFilePath);
  };

  const findUser = (data, userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return null;
    return data.users.find((user) => user.userIdNormalized === normalized.toLowerCase());
  };

  const verifyLocalUser = (userId, password) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) return { ok: false, code: 'INVALID_CREDENTIALS' };
    const data = readStore();
    const user = findUser(data, normalized);
    if (!user || user.type !== 'local') {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    const expectedHash = user.passwordHash || '';
    if (!password || hashPassword(password) !== expectedHash) {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    user.lastLoginAt = new Date().toISOString();
    writeStore(data);
    return { ok: true, user };
  };

  const upsertLdapUser = (userId, profile = {}) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      return { ok: false, code: 'INVALID_USER' };
    }

    const data = readStore();
    let user = findUser(data, normalized);
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
        lastLoginAt: now,
        ldapProvisionedAt: now
      };
      data.users.push(user);
      wasProvisioned = true;
    } else {
      user.lastLoginAt = now;
      if (user.type === 'ad' && !user.ldapProvisionedAt) {
        user.displayName = profile.displayName || user.displayName || null;
        user.mail = profile.mail || user.mail || null;
        user.department = profile.department || user.department || null;
        user.ldapProvisionedAt = now;
        wasProvisioned = true;
      }
    }

    writeStore(data);
    return { ok: true, user, provisioned: wasProvisioned };
  };

  const getAuthSnapshot = () => {
    try {
      const data = readStore();
      return {
        localUsers: data.users.filter((user) => user.type === 'local').length
      };
    } catch (err) {
      return { localUsers: 0 };
    }
  };

  const listLocalUsers = () => {
    const data = readStore();
    return data.users
      .filter((user) => user.type === 'local')
      .map((user) => ({
        userId: user.userId,
        displayName: user.displayName || user.userId,
        mail: user.mail || null,
        department: user.department || null,
        userType: 'local'
      }));
  };

  const listUsers = () => {
    const data = readStore();
    return data.users.map((user) => ({
      userId: user.userId,
      displayName: user.displayName || user.userId,
      mail: user.mail || null,
      department: user.department || null,
      userType: user.type === 'ad' ? 'ad' : 'local'
    }));
  };

  return {
    ensureStore,
    verifyLocalUser,
    upsertLdapUser,
    getAuthSnapshot,
    listLocalUsers,
    listUsers
  };
}

module.exports = {
  createUserStore
};
