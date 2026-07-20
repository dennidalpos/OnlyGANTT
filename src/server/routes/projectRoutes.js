const express = require('express');
const multer = require('multer');

function createProjectRouter(ctx) {
  const router = express.Router();
  const {
    CONFIG,
    lockStore,
    sseClients,
    normalizeDepartmentName,
    errorResponse,
    getDepartmentDataOrRespond,
    requireDepartmentAccess,
    validateDepartmentData,
    hasDepartmentPassword,
    writeDepartmentData,
    validateUserSession,
    cleanExpiredLocks,
    isLockOwner,
    getLockInfo,
    requireAdmin
  } = ctx;

  function handleJsonUpload(req, res, next) {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: CONFIG.maxUploadBytes },
      fileFilter: (innerReq, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
          cb(null, true);
        } else {
          cb(new Error('Only JSON files are allowed'));
        }
      }
    }).single('file');

    upload(req, res, (err) => {
      if (!err) {
        return next();
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 400, 'FILE_TOO_LARGE', 'File size exceeds limit');
      }
      return errorResponse(res, 400, 'INVALID_UPLOAD', err.message || 'Upload failed');
    });
  }

  router.get('/api/projects/:department/events', (req, res) => {
    try {
      const { department } = req.params;
      const normalized = normalizeDepartmentName(department);
      if (!normalized) {
        return res.status(400).end();
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      if (!sseClients.has(normalized)) {
        sseClients.set(normalized, new Set());
      }
      const clients = sseClients.get(normalized);
      clients.add(res);

      const keepAliveInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAliveInterval);
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(normalized);
        }
      });
    } catch (err) {
      res.status(500).end();
    }
  });

  router.get('/api/projects/:department', (req, res) => {
    try {
      const { department } = req.params;
      const data = getDepartmentDataOrRespond(res, department);
      if (!data) return;
      if (!requireDepartmentAccess(req, res, department, data)) return;
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

  router.get('/api/departments/:name/export', (req, res) => {
    try {
      const { name } = req.params;
      const data = getDepartmentDataOrRespond(res, name);
      if (!data) return;
      if (!requireDepartmentAccess(req, res, name, data)) return;
      const validationErrors = validateDepartmentData(data);
      const exportData = {
        ...data,
        password: undefined,
        passwordProtected: hasDepartmentPassword(data)
      };
      res.json({ data: exportData, validationErrors });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/departments/:name/import', (req, res) => {
    try {
      const { name } = req.params;
      const { data, userName } = req.body || {};
      if (!data || typeof data !== 'object') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'data is required');
      }
      delete data.passwordProtected;
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      const existingData = getDepartmentDataOrRespond(res, name);
      if (!existingData) return;
      if (!requireDepartmentAccess(req, res, name, existingData)) return;
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
      if (data.password === undefined) {
        data.password = existingData.password || null;
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

  router.post('/api/projects/:department', (req, res) => {
    try {
      const { department } = req.params;
      const { projects, expectedRevision, userName } = req.body || {};
      if (expectedRevision === undefined || expectedRevision === null) {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'expectedRevision is required');
      }
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      const data = getDepartmentDataOrRespond(res, department);
      if (!data) return;
      if (!requireDepartmentAccess(req, res, department, data)) return;
      cleanExpiredLocks();
      if (!isLockOwner(department, userName)) {
        const lockInfo = getLockInfo(department);
        if (lockInfo.locked) {
          return res.status(423).json(lockInfo);
        } else {
          return errorResponse(res, 423, 'LOCK_REQUIRED', 'Lock required to save');
        }
      }
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

  router.post('/api/upload/:department', handleJsonUpload, (req, res) => {
    try {
      const { department } = req.params;
      cleanExpiredLocks();
      const userName = req.body?.userName || 'unknown';
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      const data = getDepartmentDataOrRespond(res, department);
      if (!data) return;
      if (!requireDepartmentAccess(req, res, department, data)) return;
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
      data.projects = uploadedData.projects || [];
      data.meta = {
        updatedAt: new Date().toISOString(),
        updatedBy: userName,
        revision: (data.meta?.revision || 0) + 1
      };
      writeDepartmentData(department, data);
      res.json({ ok: true, meta: data.meta });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/lock/:department/acquire', (req, res) => {
    try {
      const { department } = req.params;
      const { userName, clientHost } = req.body || {};
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      cleanExpiredLocks();
      const existing = lockStore.get(department);
      if (existing && existing.ownerUserName !== userName) {
        const lockInfo = getLockInfo(department);
        return res.status(423).json(lockInfo);
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONFIG.lockTimeoutMinutes * 60 * 1000);
      const nextLock = {
        department,
        ownerUserName: userName,
        ownerType: req.body.ownerType || 'user',
        clientHost: clientHost || null,
        lockedAt: existing ? existing.lockedAt : now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastHeartbeatAt: now.toISOString()
      };
      lockStore.set(department, nextLock);
      res.json({
        locked: true,
        department,
        lockedBy: userName,
        ownerUserName: nextLock.ownerUserName,
        ownerType: nextLock.ownerType,
        lockedAt: nextLock.lockedAt,
        expiresAt: expiresAt.toISOString(),
        clientHost: nextLock.clientHost,
        lastHeartbeatAt: nextLock.lastHeartbeatAt
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/lock/:department/release', (req, res) => {
    try {
      const { department } = req.params;
      const { userName } = req.body || {};
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      cleanExpiredLocks();
      const lock = lockStore.get(department);
      if (!lock) {
        return res.status(204).send();
      }
      if (lock.ownerUserName !== userName) {
        return errorResponse(res, 409, 'LOCK_NOT_OWNED', 'Lock not owned by user');
      }
      lockStore.remove(department);
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/lock/:department/status', (req, res) => {
    try {
      const { department } = req.params;
      const lockInfo = getLockInfo(department);
      res.json(lockInfo);
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/lock/:department/heartbeat', (req, res) => {
    try {
      const { department } = req.params;
      const { userName } = req.body || {};
      if (!validateUserSession(req, res, userName)) {
        return;
      }
      cleanExpiredLocks();
      const lock = lockStore.get(department);
      if (!lock || lock.ownerUserName !== userName) {
        return errorResponse(res, 409, 'LOCK_NOT_OWNED', 'Lock not owned by user');
      }
      const expiresAt = new Date(Date.now() + CONFIG.lockTimeoutMinutes * 60 * 1000);
      lockStore.set(department, {
        ...lock,
        expiresAt: expiresAt.toISOString(),
        lastHeartbeatAt: new Date().toISOString()
      });
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/lock/:department/admin-release', requireAdmin, (req, res) => {
    try {
      const { department } = req.params;
      lockStore.remove(department);
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  return router;
}

module.exports = { createProjectRouter };
