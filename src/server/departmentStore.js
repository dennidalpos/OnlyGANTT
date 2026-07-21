const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { validateDepartmentData, ensureIDs } = require('./schema');

function createDepartmentStore({ dataDir, dbName = 'reparti.db', logger = console }) {
  const dbPath = path.join(dataDir, dbName);

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  function ensureDefaultDepartments(departmentsDir) {
    if (departmentsDir && fs.existsSync(departmentsDir)) {
      try {
        const files = fs.readdirSync(departmentsDir);
        for (const file of files) {
          if (file.endsWith('.json') && !file.endsWith('.bak') && !file.endsWith('.tmp')) {
            const deptName = file.replace('.json', '');
            const filePath = path.join(departmentsDir, file);
            try {
              const check = db.prepare('SELECT 1 FROM departments WHERE LOWER(name) = LOWER(?)').get(deptName);
              if (!check) {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                const errors = validateDepartmentData(data);
                if (errors.length === 0) {
                  ensureIDs(data);
                  db.prepare('INSERT INTO departments (name, data) VALUES (?, ?)').run(
                    deptName,
                    JSON.stringify(data)
                  );
                  logger.info(`[DepartmentStore] Loaded department ${deptName} into SQLite`);
                }
              }
            } catch (err) {
              logger.error(`[DepartmentStore] Failed to load initial department file ${file}:`, err.message);
            }
          }
        }
      } catch (err) {
        logger.error('[DepartmentStore] Initial departments loading error:', err.message);
      }
    }

    // Ensure Demo department exists if DB is completely empty
    const countRow = db.prepare('SELECT COUNT(*) as count FROM departments').get();
    if (!countRow || countRow.count === 0) {
      const demoData = {
        password: null,
        projects: [],
        meta: {
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          revision: 1
        }
      };
      ensureIDs(demoData);
      db.prepare('INSERT INTO departments (name, data) VALUES (?, ?)').run('Demo', JSON.stringify(demoData));
      logger.info('[DepartmentStore] Initialized default Demo department');
    }
  }

  function get(name) {
    try {
      const row = db.prepare('SELECT data FROM departments WHERE LOWER(name) = LOWER(?)').get(name);
      if (!row) return null;
      return JSON.parse(row.data);
    } catch (err) {
      logger.error(`[DepartmentStore] Error getting department ${name}:`, err.message);
      return null;
    }
  }

  function set(name, data) {
    try {
      // Preserve existing canonical name if already in DB, otherwise use given name
      const existingRow = db.prepare('SELECT name FROM departments WHERE LOWER(name) = LOWER(?)').get(name);
      const canonicalName = existingRow ? existingRow.name : name;
      db.prepare('INSERT OR REPLACE INTO departments (name, data) VALUES (?, ?)').run(
        canonicalName,
        JSON.stringify(data)
      );
      return true;
    } catch (err) {
      logger.error(`[DepartmentStore] Error setting department ${name}:`, err.message);
      throw err;
    }
  }

  function list() {
    try {
      const rows = db.prepare('SELECT name FROM departments').all();
      return rows.map(r => r.name);
    } catch (err) {
      logger.error('[DepartmentStore] Error listing departments:', err.message);
      return [];
    }
  }

  function remove(name) {
    try {
      db.prepare('DELETE FROM departments WHERE LOWER(name) = LOWER(?)').run(name);
      return true;
    } catch (err) {
      logger.error(`[DepartmentStore] Error deleting department ${name}:`, err.message);
      throw err;
    }
  }

  function exists(name) {
    try {
      const row = db.prepare('SELECT 1 FROM departments WHERE LOWER(name) = LOWER(?)').get(name);
      return !!row;
    } catch (err) {
      return false;
    }
  }

  function close() {
    try {
      db.close();
    } catch (_) {}
  }

  return {
    ensureDefaultDepartments,
    runMigrations: ensureDefaultDepartments,
    get,
    set,
    list,
    remove,
    exists,
    close
  };
}

module.exports = {
  createDepartmentStore
};
