const express = require('express');
const crypto = require('crypto');
const os = require('os');
const packageInfo = require('../../../package.json');

function createAdminRouter(ctx) {
  const router = express.Router();
  const {
    CONFIG,
    PATHS,
    userStore,
    departmentStore,
    lockStore,
    adminTokens,
    userSessions,
    SERVER_STARTED_AT,
    requireAdmin,
    errorResponse,
    revokeUserSessionsForUser,
    createUserSession,
    persistAdminPassword,
    verifyAdminPassword,
    getLdapConfigForAuth,
    testLdapConnection,
    getSystemConfigState,
    parseNumber,
    parseBoolean,
    normalizeSystemConfigValue,
    writeSystemConfig,
    applySystemConfig,
    listLdapUsers,
    logAuditEvent,
    restartServer,
    normalizeModules,
    hasSelectedModules,
    buildModularBackup,
    importDepartmentsBackup,
    applyImportedSettings
  } = ctx;

  router.post('/api/admin/login', (req, res) => {
    try {
      const { userId, password } = req.body || {};
      if (userId !== CONFIG.adminUser) {
        return errorResponse(res, 401, 'INVALID_USER', 'Invalid admin user');
      }
      if (!ctx.isAdminConfigured()) {
        return errorResponse(res, 503, 'ADMIN_PASSWORD_NOT_CONFIGURED', 'Admin password is not configured');
      }
      if (!verifyAdminPassword(password)) {
        return errorResponse(res, 401, 'INVALID_PASSWORD', 'Invalid admin password');
      }
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + CONFIG.adminSessionTtlHours * 60 * 60 * 1000);
      revokeUserSessionsForUser(userId);
      const userToken = createUserSession(userId, { userType: 'admin' });
      adminTokens.set(token, {
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        userToken
      });
      res.json({ token, userToken });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/logout', requireAdmin, (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.substring(7) : null;
      if (token) {
        const session = adminTokens.get(token);
        if (session?.userToken) {
          userSessions.delete(session.userToken);
        }
        adminTokens.delete(token);
      }
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/setup', (req, res) => {
    try {
      const { password } = req.body || {};
      if (ctx.isAdminConfigured()) {
        return errorResponse(res, 409, 'ALREADY_CONFIGURED', 'Admin password is already configured');
      }
      if (!password || password.length < 6) {
        return errorResponse(res, 400, 'INVALID_PASSWORD', 'Password must be at least 6 characters');
      }
      persistAdminPassword(password);
      res.json({ ok: true, message: 'Admin password configured successfully' });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/change-password', requireAdmin, (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body || {};
      if (ctx.isAdminManagedByEnv()) {
        return errorResponse(res, 409, 'ADMIN_PASSWORD_MANAGED_BY_ENV', 'Admin password is managed by environment variables');
      }
      if (!verifyAdminPassword(oldPassword)) {
        return errorResponse(res, 401, 'INVALID_PASSWORD', 'Current password is incorrect');
      }
      if (!newPassword || newPassword.length < 6) {
        return errorResponse(res, 400, 'INVALID_NEW_PASSWORD', 'New password must be at least 6 characters');
      }
      persistAdminPassword(newPassword);
      revokeUserSessionsForUser(CONFIG.adminUser);
      const currentToken = req.headers.authorization?.replace('Bearer ', '');
      for (const [token] of adminTokens) {
        if (token !== currentToken) {
          const session = adminTokens.get(token);
          if (session?.userToken) {
            userSessions.delete(session.userToken);
          }
          adminTokens.delete(token);
        }
      }
      res.json({ ok: true, message: 'Admin password changed successfully' });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/ldap/test', requireAdmin, async (req, res) => {
    try {
      const { config, testUserId } = req.body || {};
      const baseConfig = getLdapConfigForAuth();
      const overrideConfig = { ...(config || {}) };
      if (Object.prototype.hasOwnProperty.call(overrideConfig, 'bindPassword') && overrideConfig.bindPassword === null) {
        delete overrideConfig.bindPassword;
      }
      const mergedConfig = { ...baseConfig, ...overrideConfig };
      const result = await testLdapConnection({
        configOverride: mergedConfig,
        testUserId: testUserId || null
      });
      if (!result.ok) {
        const statusCode = result.code === 'LDAP_DOWN' ? 503 : 400;
        return errorResponse(res, statusCode, result.code || 'LDAP_TEST_FAILED', result.message || 'LDAP test failed', result.details || null);
      }
      res.json(result);
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/admin/system-config', requireAdmin, (req, res) => {
    try {
      res.json(getSystemConfigState());
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/admin/system-status', requireAdmin, (req, res) => {
    try {
      const memory = process.memoryUsage();
      res.json({
        ok: true,
        app: {
          name: packageInfo.name || 'OnlyGANTT',
          version: packageInfo.version || 'dev'
        },
        server: {
          status: 'online',
          startedAt: SERVER_STARTED_AT,
          uptimeSeconds: Math.floor(process.uptime()),
          pid: process.pid,
          nodeVersion: process.version
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          platform: process.platform,
          arch: process.arch,
          hostname: os.hostname(),
          cpuCount: os.cpus()?.length || 0,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          memoryRss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal
        }
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/system-config', requireAdmin, (req, res) => {
    try {
      const payload = req.body || {};
      const serverPayload = payload.server || {};
      const ldapPayload = payload.ldap || {};
      const httpsPayload = payload.https || {};

      const currentConfig = getSystemConfigState({ includeBindPassword: true });
      const nextConfig = {
        server: { ...currentConfig.server },
        ldap: { ...currentConfig.ldap },
        https: { ...currentConfig.https }
      };

      if ('lockTimeoutMinutes' in serverPayload) {
        const val = parseNumber(serverPayload.lockTimeoutMinutes, null);
        if (val === null || val < 1 || val > 1440 || !Number.isInteger(val)) {
          return errorResponse(res, 400, 'VALIDATION_ERROR', 'lockTimeoutMinutes must be an integer between 1 and 1440');
        }
        nextConfig.server.lockTimeoutMinutes = val;
      }
      if ('userSessionTtlHours' in serverPayload) {
        const val = parseNumber(serverPayload.userSessionTtlHours, null);
        if (val === null || val < 1 || val > 168 || !Number.isInteger(val)) {
          return errorResponse(res, 400, 'VALIDATION_ERROR', 'userSessionTtlHours must be an integer between 1 and 168');
        }
        nextConfig.server.userSessionTtlHours = val;
      }
      if ('adminSessionTtlHours' in serverPayload) {
        const val = parseNumber(serverPayload.adminSessionTtlHours, null);
        if (val === null || val < 1 || val > 168 || !Number.isInteger(val)) {
          return errorResponse(res, 400, 'VALIDATION_ERROR', 'adminSessionTtlHours must be an integer between 1 and 168');
        }
        nextConfig.server.adminSessionTtlHours = val;
      }
      if ('maxUploadBytes' in serverPayload) {
        const val = parseNumber(serverPayload.maxUploadBytes, null);
        if (val === null || val < 1024 || val > 50000000 || !Number.isInteger(val)) {
          return errorResponse(res, 400, 'VALIDATION_ERROR', 'maxUploadBytes must be an integer between 1024 and 50000000');
        }
        nextConfig.server.maxUploadBytes = val;
      }
      if ('enableBak' in serverPayload) nextConfig.server.enableBak = parseBoolean(serverPayload.enableBak);

      if ('enabled' in ldapPayload) nextConfig.ldap.enabled = parseBoolean(ldapPayload.enabled);
      if ('log' in ldapPayload) nextConfig.ldap.log = parseBoolean(ldapPayload.log);
      if ('url' in ldapPayload) nextConfig.ldap.url = normalizeSystemConfigValue(ldapPayload.url, currentConfig.ldap.url);
      if ('bindDn' in ldapPayload) nextConfig.ldap.bindDn = normalizeSystemConfigValue(ldapPayload.bindDn, currentConfig.ldap.bindDn);
      if ('baseDn' in ldapPayload) nextConfig.ldap.baseDn = normalizeSystemConfigValue(ldapPayload.baseDn, currentConfig.ldap.baseDn);
      if ('userFilter' in ldapPayload) nextConfig.ldap.userFilter = normalizeSystemConfigValue(ldapPayload.userFilter, currentConfig.ldap.userFilter);
      if ('requiredGroupDn' in ldapPayload) nextConfig.ldap.requiredGroupDn = normalizeSystemConfigValue(ldapPayload.requiredGroupDn, currentConfig.ldap.requiredGroupDn);
      if ('groupSearchBase' in ldapPayload) nextConfig.ldap.groupSearchBase = normalizeSystemConfigValue(ldapPayload.groupSearchBase, currentConfig.ldap.groupSearchBase);
      if ('localFallback' in ldapPayload) nextConfig.ldap.localFallback = parseBoolean(ldapPayload.localFallback);
      if ('bindPassword' in ldapPayload) {
        if (ldapPayload.bindPassword !== null) {
          nextConfig.ldap.bindPassword = normalizeSystemConfigValue(ldapPayload.bindPassword, currentConfig.ldap.bindPassword);
        }
      }

      if ('enabled' in httpsPayload) nextConfig.https.enabled = parseBoolean(httpsPayload.enabled);
      if ('keyPath' in httpsPayload) nextConfig.https.keyPath = normalizeSystemConfigValue(httpsPayload.keyPath, currentConfig.https.keyPath);
      if ('certPath' in httpsPayload) nextConfig.https.certPath = normalizeSystemConfigValue(httpsPayload.certPath, currentConfig.https.certPath);

      delete nextConfig.ldap.bindPasswordSet;
      writeSystemConfig(nextConfig);
      applySystemConfig(nextConfig);

      res.json({
        ok: true,
        ...getSystemConfigState()
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const storedUsers = userStore.listUsers();
      let ldapUsers = [];
      let ldapError = null;

      if (CONFIG.ldapEnabled) {
        try {
          const ldapResult = await listLdapUsers(getLdapConfigForAuth());
          if (ldapResult.ok) {
            ldapUsers = ldapResult.users || [];
            ldapUsers.forEach((user) => {
              if (!user?.userId) return;
              userStore.upsertLdapUser(
                user.userId,
                {
                  displayName: user.displayName,
                  mail: user.mail,
                  department: user.department || null
                },
                { touchLoginAt: false }
              );
            });
          } else {
            ldapError = {
              code: ldapResult.code || 'LDAP_ERROR',
              message: ldapResult.message || 'LDAP search failed'
            };
          }
        } catch (err) {
          ldapError = {
            code: err?.code || 'LDAP_ERROR',
            message: err?.message || 'LDAP search failed'
          };
        }
      }

      const mergedUsers = new Map();
      storedUsers.forEach((user) => {
        const key = (user.userId || '').toLowerCase();
        if (key) {
          mergedUsers.set(key, user);
        }
      });
      ldapUsers.forEach((user) => {
        const key = (user.userId || '').toLowerCase();
        if (!key) return;
        if (!mergedUsers.has(key)) {
          mergedUsers.set(key, user);
        }
      });

      res.json({
        users: Array.from(mergedUsers.values()),
        ldapEnabled: CONFIG.ldapEnabled,
        ldapError
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/users/local', requireAdmin, (req, res) => {
    try {
      const { userId, displayName, mail, department, password } = req.body || {};
      const result = userStore.upsertLocalUser(userId, {
        displayName,
        mail,
        department,
        password
      });

      if (!result.ok) {
        const statusCode = result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'USER_TYPE_CONFLICT'
            ? 409
            : 400;
        return errorResponse(res, statusCode, result.code, result.message);
      }

      if (typeof password === 'string' && password) {
        revokeUserSessionsForUser(result.user.userId);
      }

      res.json({
        ok: true,
        created: result.created,
        user: {
          userId: result.user.userId,
          displayName: result.user.displayName || result.user.userId,
          mail: result.user.mail || null,
          department: result.user.department || null,
          userType: 'local',
          lastLoginAt: result.user.lastLoginAt || result.user.createdAt || null,
          loginHistory: Array.isArray(result.user.loginHistory) ? result.user.loginHistory : []
        }
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.delete('/api/admin/users/local/:userId', requireAdmin, (req, res) => {
    try {
      const { userId } = req.params;
      const result = userStore.deleteLocalUser(userId);
      if (!result.ok) {
        const statusCode = result.code === 'NOT_FOUND' ? 404 : 409;
        return errorResponse(res, statusCode, result.code, result.message);
      }

      revokeUserSessionsForUser(result.userId);
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/admin/departments', requireAdmin, (req, res) => {
    try {
      const names = departmentStore.list();
      const departments = [];
      for (const deptName of names) {
        const data = departmentStore.get(deptName);
        if (!data) continue;
        departments.push({
          name: deptName,
          file: `${deptName}.json`,
          protected: ctx.hasDepartmentPassword(data),
          needsPasswordSetup: false,
          meta: data.meta,
          lock: ctx.getLockInfo(deptName)
        });
      }
      res.json({ departments });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/server-restart', requireAdmin, (req, res) => {
    try {
      logAuditEvent({
        eventType: 'SERVER_RESTART',
        actor: CONFIG.adminUser,
        ip: req.ip,
        logDir: PATHS.logs,
        details: {
          userAgent: req.headers['user-agent'] || null
        }
      });
      res.json({ ok: true });
      setTimeout(() => {
        try {
          restartServer();
        } catch (err) {
          console.error(`Restart failed: ${err.message}`);
        }
      }, 250);
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/export', requireAdmin, (req, res) => {
    try {
      const modules = normalizeModules(req.body?.modules);
      if (!hasSelectedModules(modules)) {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'At least one module must be selected');
      }

      res.json(buildModularBackup(modules));
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/admin/import', requireAdmin, (req, res) => {
    try {
      const { backup, overwriteExisting = false } = req.body || {};
      const modules = normalizeModules(req.body?.modules);

      if (!backup || typeof backup !== 'object') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'backup data is required');
      }

      if (!hasSelectedModules(modules)) {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'At least one module must be selected');
      }

      let departmentPayload = null;
      let userPayload = null;
      let settingsPayload = null;

      if (modules.departments) {
        if (Array.isArray(backup.modules?.departments?.data)) {
          departmentPayload = backup.modules.departments.data;
        } else {
          return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: departments data missing');
        }
      }

      if (modules.users) {
        if (Array.isArray(backup.modules?.users?.data)) {
          userPayload = backup.modules.users.data;
        } else {
          return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: users data missing');
        }
      }

      if (modules.settings) {
        if (backup.modules?.settings?.data) {
          settingsPayload = backup.modules.settings.data;
        } else {
          return errorResponse(res, 400, 'INVALID_BACKUP', 'Invalid backup format: settings data missing');
        }
      }

      const results = {};
      let summary = {
        totalDepartments: departmentPayload ? departmentPayload.length : 0,
        totalUsers: userPayload ? userPayload.length : 0,
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

      if (modules.users) {
        const userResults = userStore.importUsers(userPayload, overwriteExisting);
        results.users = userResults;
        summary = {
          ...summary,
          imported: summary.imported + userResults.imported.length,
          skipped: summary.skipped + userResults.skipped.length,
          errors: summary.errors + userResults.errors.length
        };
      } else {
        results.users = { skipped: true, reason: 'Module disabled' };
      }

      if (modules.settings) {
        const applied = applyImportedSettings(settingsPayload);
        results.settings = { applied };
        summary = {
          ...summary,
          imported: summary.imported + (Object.keys(applied).length > 0 ? 1 : 0)
        };
      } else {
        results.settings = { skipped: true, reason: 'Module disabled' };
      }

      res.json({
        ok: true,
        results,
        summary
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  return router;
}

module.exports = { createAdminRouter };
