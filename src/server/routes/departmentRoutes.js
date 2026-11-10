const express = require('express');

function createDepartmentRouter(ctx) {
  const router = express.Router();
  const {
    departmentStore,
    lockStore,
    errorResponse,
    hasDepartmentPassword,
    getDepartmentDataOrRespond,
    verifyDepartmentPassword,
    writeDepartmentData,
    setDepartmentPassword,
    grantDepartmentAccess,
    requireAdmin
  } = ctx;

  router.get('/api/departments', (req, res) => {
    try {
      const names = departmentStore.list();
      const departments = [];
      for (const deptName of names) {
        const data = departmentStore.get(deptName);
        if (!data) continue;
        departments.push({
          name: deptName,
          protected: hasDepartmentPassword(data),
          needsPasswordSetup: false,
          readOnly: false
        });
      }
      res.json({ departments });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to list departments');
    }
  });

  router.delete('/api/departments/:name', requireAdmin, (req, res) => {
    try {
      const { name } = req.params;
      if (!departmentStore.exists(name)) {
        return errorResponse(res, 404, 'NOT_FOUND', 'Department not found');
      }
      lockStore.remove(name);
      departmentStore.remove(name);
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/departments/:name/verify', (req, res) => {
    try {
      const { name } = req.params;
      const { password } = req.body || {};
      const data = getDepartmentDataOrRespond(res, name);
      if (!data) return;
      if (verifyDepartmentPassword(data, password)) {
        if (typeof data.password === 'string' && data.password.trim()) {
          writeDepartmentData(name, data);
        }
        grantDepartmentAccess(req, name);
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

  router.post('/api/departments/:name/change-password', (req, res) => {
    try {
      const { name } = req.params;
      const { oldPassword, newPassword } = req.body || {};
      const data = getDepartmentDataOrRespond(res, name);
      if (!data) return;
      if (typeof newPassword !== 'string') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'newPassword is required');
      }
      const isSetupMode = !hasDepartmentPassword(data);
      if (!isSetupMode) {
        if (!verifyDepartmentPassword(data, oldPassword)) {
          return errorResponse(res, 401, 'INVALID_PASSWORD', 'Invalid old password');
        }
      }
      setDepartmentPassword(data, newPassword);
      data.meta = data.meta || {};
      data.meta.updatedAt = new Date().toISOString();
      data.meta.updatedBy = 'password_change';
      data.meta.revision = (data.meta.revision || 0) + 1;
      writeDepartmentData(name, data);
      lockStore.remove(name);
      res.json({ ok: true });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/departments/:name/reset-password', requireAdmin, (req, res) => {
    try {
      const { name } = req.params;
      const { newPassword } = req.body || {};
      const data = getDepartmentDataOrRespond(res, name);
      if (!data) return;
      setDepartmentPassword(data, newPassword);
      data.meta = data.meta || {};
      data.meta.updatedAt = new Date().toISOString();
      data.meta.updatedBy = 'admin';
      data.meta.revision = (data.meta.revision || 0) + 1;
      writeDepartmentData(name, data);
      lockStore.remove(name);
      res.json({ ok: true });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  return router;
}

module.exports = { createDepartmentRouter };
