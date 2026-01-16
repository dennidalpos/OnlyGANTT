const fs = require('fs');
const path = require('path');

function createLockStore({ dataDir, fileName = 'locks.json', logger = console }) {
  const locks = new Map();
  const filePath = path.join(dataDir, fileName);

  function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  function atomicWrite(data) {
    ensureDataDir();
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.renameSync(tmpPath, filePath);
  }

  function serializeLocks() {
    return {
      savedAt: new Date().toISOString(),
      locks: Array.from(locks.values())
    };
  }

  function persist() {
    atomicWrite(serializeLocks());
  }

  function isExpired(lock, now = new Date()) {
    if (!lock || !lock.expiresAt) return true;
    return new Date(lock.expiresAt) <= now;
  }

  function logExpiredLock(lock) {
    logger.info(
      `[LockStore] expired lock removed for ${lock.department} (owner=${lock.ownerUserName || 'unknown'})`
    );
  }

  function cleanExpiredLocks() {
    const now = new Date();
    let removed = 0;
    for (const [department, lock] of locks.entries()) {
      if (isExpired(lock, now)) {
        locks.delete(department);
        removed += 1;
        logExpiredLock(lock);
      }
    }
    if (removed > 0) {
      persist();
    }
    return removed;
  }

  function loadFromDisk() {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
      return { loaded: 0, expired: 0 };
    }

    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      logger.warn(`[LockStore] failed to parse ${filePath}: ${err.message}`);
      return { loaded: 0, expired: 0 };
    }

    const list = Array.isArray(payload) ? payload : payload?.locks;
    if (!Array.isArray(list)) {
      logger.warn(`[LockStore] invalid lock payload in ${filePath}`);
      return { loaded: 0, expired: 0 };
    }

    const now = new Date();
    let loaded = 0;
    let expired = 0;

    list.forEach(lock => {
      if (!lock || typeof lock.department !== 'string') return;
      if (isExpired(lock, now)) {
        expired += 1;
        logExpiredLock(lock);
        return;
      }
      locks.set(lock.department, lock);
      loaded += 1;
    });

    if (expired > 0) {
      persist();
    }

    return { loaded, expired };
  }

  function get(department) {
    return locks.get(department);
  }

  function set(department, lock) {
    locks.set(department, lock);
    persist();
  }

  function remove(department) {
    const removed = locks.delete(department);
    if (removed) {
      persist();
    }
    return removed;
  }

  function entries() {
    return locks.entries();
  }

  function startCleanup(intervalMs) {
    const interval = setInterval(cleanExpiredLocks, intervalMs);
    if (typeof interval.unref === 'function') {
      interval.unref();
    }
    return interval;
  }

  return {
    loadFromDisk,
    cleanExpiredLocks,
    get,
    set,
    remove,
    entries,
    startCleanup
  };
}

module.exports = {
  createLockStore
};
