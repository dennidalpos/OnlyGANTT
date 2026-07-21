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
    const demoRow = db.prepare('SELECT data FROM departments WHERE LOWER(name) = ?').get('demo');

    let needSeed = !demoRow;
    let seedProjects = [];

    if (departmentsDir && fs.existsSync(departmentsDir)) {
      const demoSeedFile = path.join(departmentsDir, 'Demo.json');
      if (fs.existsSync(demoSeedFile)) {
        try {
          const content = fs.readFileSync(demoSeedFile, 'utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
            seedProjects = parsed.projects;
          }
        } catch (_) {}
      }
    }

    if (seedProjects.length === 0) {
      seedProjects = [
        {
          id: 'f8e7a1b2-3c4d-5e6f-7890-1a2b3c4d5e6f',
          nome: 'Migrazione Cloud Infrastructure',
          colore: '#3b82f6',
          dataInizio: '2026-01-15',
          dataFine: '2026-09-30',
          stato: 'in_corso',
          percentualeCompletamento: 65,
          fasi: [
            {
              id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              nome: 'Analisi Requisiti',
              colore: '#3b82f6',
              dataInizio: '2026-01-15',
              dataFine: '2026-02-28',
              stato: 'completato',
              percentualeCompletamento: 100,
              milestone: false,
              includeFestivi: false,
              note: 'Analisi requisiti infrastruttura cloud'
            },
            {
              id: 'b2c3d4e5-f678-9012-3456-7890abcdef12',
              nome: 'Progettazione Architettura',
              colore: '#8b5cf6',
              dataInizio: '2026-03-01',
              dataFine: '2026-04-15',
              stato: 'completato',
              percentualeCompletamento: 100,
              milestone: false,
              includeFestivi: false,
              note: 'Design architettura AWS/Azure'
            },
            {
              id: 'c3d4e5f6-7890-1234-5678-90abcdef1234',
              nome: 'Sviluppo & Migration',
              colore: '#10b981',
              dataInizio: '2026-04-16',
              dataFine: '2026-07-31',
              stato: 'in_corso',
              percentualeCompletamento: 45,
              milestone: false,
              includeFestivi: false,
              note: 'Implementazione e migrazione servizi cloud'
            },
            {
              id: 'd4e5f678-9012-3456-7890-abcdef123456',
              nome: 'Test & Validazione',
              colore: '#f59e0b',
              dataInizio: '2026-08-01',
              dataFine: '2026-08-31',
              stato: 'da_iniziare',
              percentualeCompletamento: 0,
              milestone: false,
              includeFestivi: false,
              note: ''
            },
            {
              id: 'e5f67890-1234-5678-90ab-cdef12345678',
              nome: 'Go-Live Milestone',
              colore: '#ef4444',
              dataInizio: '2026-09-01',
              dataFine: '2026-09-30',
              stato: 'da_iniziare',
              percentualeCompletamento: 0,
              milestone: true,
              includeFestivi: false,
              note: 'Rilascio in produzione'
            }
          ]
        },
        {
          id: '12345678-90ab-cdef-1234-567890abcdef',
          nome: 'Portale Servizi Cittadino',
          colore: '#8b5cf6',
          dataInizio: '2026-02-01',
          dataFine: '2026-12-31',
          stato: 'in_corso',
          percentualeCompletamento: 40,
          fasi: [
            {
              id: 'f1a2b3c4-d5e6-7890-1234-567890abcdef',
              nome: 'UX & Wireframing',
              colore: '#8b5cf6',
              dataInizio: '2026-02-01',
              dataFine: '2026-03-31',
              stato: 'completato',
              percentualeCompletamento: 100,
              milestone: false,
              includeFestivi: false,
              note: ''
            },
            {
              id: 'f2b3c4d5-e6f7-8901-2345-67890abcdef1',
              nome: 'Sviluppo Frontend & Backend',
              colore: '#10b981',
              dataInizio: '2026-04-01',
              dataFine: '2026-09-30',
              stato: 'in_corso',
              percentualeCompletamento: 50,
              milestone: false,
              includeFestivi: false,
              note: ''
            }
          ]
        }
      ];
    }

    if (demoRow) {
      try {
        const currentData = JSON.parse(demoRow.data);
        if (!Array.isArray(currentData.projects) || currentData.projects.length === 0) {
          currentData.projects = seedProjects;
          currentData.meta = currentData.meta || {
            updatedAt: new Date().toISOString(),
            updatedBy: 'system',
            revision: 1
          };
          ensureIDs(currentData);
          db.prepare('INSERT OR REPLACE INTO departments (name, data) VALUES (?, ?)').run('Demo', JSON.stringify(currentData));
          logger.info('[DepartmentStore] Populated empty Demo department with sample projects');
        }
      } catch (_) {}
    } else {
      const demoData = {
        password: null,
        projects: seedProjects,
        meta: {
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          revision: 1
        }
      };
      ensureIDs(demoData);
      db.prepare('INSERT INTO departments (name, data) VALUES (?, ?)').run('Demo', JSON.stringify(demoData));
      logger.info('[DepartmentStore] Initialized default Demo department with sample projects');
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
