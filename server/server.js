const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { validateDepartmentData, ensureIDs } = require('./schema');

const app = express();

const CONFIG = {
  port: 3000,
  dataDir: 'data',
  enableBak: true,
  lockTimeoutMinutes: 60,
  adminSessionTtlHours: 8,
  maxUploadBytes: 2000000,
  adminUser: process.env.ONLYGANTT_ADMIN_USER || 'admin',
  adminPassword: process.env.ONLYGANTT_ADMIN_PASSWORD || 'admin123',
  adminResetCode: process.env.ONLYGANTT_ADMIN_RESET_CODE || null
};

app.use(express.json());
app.use(express.static('public'));
app.use('/src', express.static('src'));

const locks = new Map();
const adminTokens = new Map();

const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

function normalizeDepartmentName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length > 50) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null;
  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) return null;
  return trimmed;
}

function getDepartmentFilePath(department) {
  const normalized = normalizeDepartmentName(department);
  if (!normalized) return null;
  return path.join(CONFIG.dataDir, `${normalized}.json`);
}

function ensureDataDir() {
  if (!fs.existsSync(CONFIG.dataDir)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  }
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
  const now = new Date();
  for (const [dept, lock] of locks.entries()) {
    if (new Date(lock.expiresAt) < now) {
      locks.delete(dept);
    }
  }
}

function getLockInfo(department) {
  cleanExpiredLocks();
  const lock = locks.get(department);
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
  const lock = locks.get(department);
  if (!lock) return false;
  return lock.ownerUserName === userName;
}

ensureDataDir();

function validateExistingDepartments() {
  try {
    const files = fs.readdirSync(CONFIG.dataDir);
    files.forEach(file => {
      if (file.endsWith('.json') && !file.endsWith('.bak') && !file.endsWith('.tmp')) {
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
  const files = fs.readdirSync(CONFIG.dataDir);
  const departments = [];

  for (const file of files) {
    if (file.endsWith('.json') && !file.endsWith('.bak') && !file.endsWith('.tmp')) {
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
      users: modules.users ? { data: [] } : { data: null },
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

      if (locks.has(normalized)) {
        locks.delete(normalized);
      }
    } catch (err) {
      results.errors.push({
        department: normalized,
        error: err.message
      });
    }
  }

  return results;
}

const lockCleanupInterval = setInterval(cleanExpiredLocks, 60 * 1000);
if (typeof lockCleanupInterval.unref === 'function') {
  lockCleanupInterval.unref();
}

app.get('/api/departments', (req, res) => {
  try {
    ensureDataDir();
    const files = fs.readdirSync(CONFIG.dataDir);
    const departments = [];
    for (const file of files) {
      if (file.endsWith('.json') && !file.endsWith('.bak') && !file.endsWith('.tmp')) {
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
    locks.delete(name);
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
    if (!userName) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'userName is required');
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
    if (!userName) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'userName is required');
    }
    cleanExpiredLocks();
    const existing = locks.get(department);
    if (existing && existing.ownerUserName !== userName) {
      const lockInfo = getLockInfo(department);
      return res.status(423).json(lockInfo);
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIG.lockTimeoutMinutes * 60 * 1000);
    locks.set(department, {
      department,
      ownerUserName: userName,
      ownerType: req.body.ownerType || 'user',
      clientHost: clientHost || null,
      lockedAt: existing ? existing.lockedAt : now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastHeartbeatAt: now.toISOString()
    });
    res.json({
      locked: true,
      department,
      lockedBy: userName,
      ownerUserName: locks.get(department).ownerUserName,
      ownerType: locks.get(department).ownerType,
      lockedAt: locks.get(department).lockedAt,
      expiresAt: expiresAt.toISOString(),
      clientHost: locks.get(department).clientHost,
      lastHeartbeatAt: locks.get(department).lastHeartbeatAt
    });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/release', (req, res) => {
  try {
    const { department } = req.params;
    const { userName } = req.body;
    const lock = locks.get(department);
    if (lock && lock.ownerUserName === userName) {
      locks.delete(department);
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
    cleanExpiredLocks();
    const lock = locks.get(department);
    if (!lock || lock.ownerUserName !== userName) {
      return errorResponse(res, 409, 'LOCK_NOT_OWNED', 'Lock not owned by user');
    }
    const expiresAt = new Date(Date.now() + CONFIG.lockTimeoutMinutes * 60 * 1000);
    lock.expiresAt = expiresAt.toISOString();
    lock.lastHeartbeatAt = new Date().toISOString();
    res.status(204).send();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/lock/:department/admin-release', requireAdmin, (req, res) => {
  try {
    const { department } = req.params;
    locks.delete(department);
    res.status(204).send();
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
    res.json({ token });
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

app.get('/api/admin/departments', requireAdmin, (req, res) => {
  try {
    ensureDataDir();
    const files = fs.readdirSync(CONFIG.dataDir);
    const departments = [];
    for (const file of files) {
      if (file.endsWith('.json') && !file.endsWith('.bak') && !file.endsWith('.tmp')) {
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
    }
    res.json({ departments });
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

    if (modules.departments) {
      if (Array.isArray(backup.departments)) {
        departmentPayload = backup.departments;
      } else if (Array.isArray(backup.modules?.departments?.data)) {
        departmentPayload = backup.modules.departments.data;
      } else {
        return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: departments data missing');
      }
    }

    const results = {};
    let summary = {
      totalDepartments: departmentPayload ? departmentPayload.length : 0,
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

    const unsupportedReason = 'Module not supported yet';
    results.users = modules.users ? { skipped: true, reason: unsupportedReason } : { skipped: true, reason: 'Module disabled' };
    results.settings = modules.settings ? { skipped: true, reason: unsupportedReason } : { skipped: true, reason: 'Module disabled' };
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
app.listen(PORT, () => {
  console.log(`OnlyGANTT server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${path.resolve(CONFIG.dataDir)}`);
});
