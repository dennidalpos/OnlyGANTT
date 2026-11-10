const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function createLockStore({ dataDir, dbName = 'locks.db', logger = console }) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, dbName);
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS locks (
      department_normalized TEXT PRIMARY KEY,
      department TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);

  const locks = new Map();

  function isExpired(lock, now = new Date()) {
    if (!lock || !lock.expiresAt) return true;
    return new Date(lock.expiresAt) <= now;
  }

  function logExpiredLock(lock) {
    logger.info(
      `[LockStore] expired lock removed for ${lock.department} (owner=${lock.ownerUserName || 'unknown'})`
    );
  }

  function persistLock(department, lock) {
    if (!department) return;
    const norm = department.toLowerCase();
    if (!lock) {
      db.prepare('DELETE FROM locks WHERE department_normalized = ?').run(norm);
    } else {
      db.prepare('INSERT OR REPLACE INTO locks (department_normalized, department, data) VALUES (?, ?, ?)').run(
        norm,
        lock.department || department,
        JSON.stringify(lock)
      );
    }
  }

  function cleanExpiredLocks() {
    const now = new Date();
    let removed = 0;
    for (const [department, lock] of locks.entries()) {
      if (isExpired(lock, now)) {
        locks.delete(department);
        persistLock(department, null);
        removed += 1;
        logExpiredLock(lock);
      }
    }
    return removed;
  }

  function loadFromDisk() {
    let loaded = 0;
    let expired = 0;
    const now = new Date();

    // Load active locks from SQLite
    try {
      const rows = db.prepare('SELECT department, data FROM locks').all();
      rows.forEach(row => {
        try {
          const lock = JSON.parse(row.data);
          if (isExpired(lock, now)) {
            expired += 1;
            persistLock(row.department, null);
            logExpiredLock(lock);
          } else {
            locks.set(row.department, lock);
            loaded += 1;
          }
        } catch (_) {}
      });
    } catch (err) {
      logger.error(`[LockStore] Error loading locks from SQLite:`, err.message);
    }

    return { loaded, expired };
  }

  function get(department) {
    if (!department) return null;
    return locks.get(department);
  }

  function set(department, lock) {
    if (!department) return;
    locks.set(department, lock);
    persistLock(department, lock);
  }

  function remove(department) {
    if (!department) return false;
    const removed = locks.delete(department);
    if (removed) {
      persistLock(department, null);
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

  function close() {
    try {
      db.close();
    } catch (_) {}
  }

  return {
    loadFromDisk,
    cleanExpiredLocks,
    get,
    set,
    remove,
    entries,
    startCleanup,
    close
  };
}

module.exports = {
  createLockStore
};
