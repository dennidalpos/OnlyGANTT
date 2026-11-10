const express = require('express');

function createAuthRouter(ctx) {
  const router = express.Router();
  const {
    CONFIG,
    userStore,
    getUserToken,
    getValidUserSession,
    userSessions,
    releaseLocksOwnedByUser,
    errorResponse,
    createAuthLoginResponse,
    getLdapConfigForAuth,
    authenticateLdapUser
  } = ctx;

  router.get('/api/auth/config', (req, res) => {
    try {
      const snapshot = userStore.getAuthSnapshot();
      res.json({
        ldapEnabled: CONFIG.ldapEnabled,
        localFallback: CONFIG.ldapLocalFallback,
        localUsers: snapshot.localUsers,
        usernameOnlyLoginEnabled: false,
        adminConfigured: ctx.isAdminConfigured(),
        adminManagedByEnv: ctx.isAdminManagedByEnv(),
        adminResetEnabled: !!CONFIG.adminResetCode
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/auth/login', async (req, res) => {
    try {
      const { userId, password, department } = req.body || {};
      if (!userId || typeof userId !== 'string') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'userId is required');
      }
      if (userId.trim() === CONFIG.adminUser) {
        return errorResponse(res, 403, 'ADMIN_LOCAL_ONLY', 'Admin access is local only');
      }

      const normalizedUserId = userId.trim();
      const authSnapshot = userStore.getAuthSnapshot();
      const ldapConfig = getLdapConfigForAuth();

      if (CONFIG.ldapEnabled) {
        const ldapResult = await authenticateLdapUser({ userId: normalizedUserId, password }, ldapConfig);
        if (ldapResult.ok) {
          const storeResult = userStore.upsertLdapUser(normalizedUserId, {
            displayName: ldapResult.profile.displayName,
            mail: ldapResult.profile.mail,
            department: ldapResult.profile.department || department || null
          });
          return res.json(createAuthLoginResponse(normalizedUserId, {
            authType: 'ldap',
            user: {
              type: 'ad',
              displayName: storeResult.user.displayName,
              mail: storeResult.user.mail,
              department: storeResult.user.department || department || null
            }
          }));
        }

        if (ldapResult.code === 'GROUP_REQUIRED') {
          return errorResponse(res, 403, ldapResult.code, ldapResult.message);
        }

        if (CONFIG.ldapLocalFallback && ldapResult.code !== 'GROUP_REQUIRED') {
          const localResult = userStore.verifyLocalUser(normalizedUserId, password);
          if (localResult.ok) {
            return res.json(createAuthLoginResponse(normalizedUserId, {
              authType: 'local',
              user: {
                type: 'local',
                displayName: localResult.user.displayName || normalizedUserId,
                mail: localResult.user.mail || null,
                department: localResult.user.department || department || null
              }
            }));
          }
        }

        const statusCode = ldapResult.code === 'LDAP_DOWN'
          ? 503
          : ldapResult.code === 'LDAP_CONFIG_ERROR'
            ? 500
            : 401;
        return errorResponse(res, statusCode, ldapResult.code, ldapResult.message);
      }

      if (authSnapshot.localUsers === 0) {
        return errorResponse(
          res,
          403,
          'USER_LOGIN_NOT_CONFIGURED',
          'User login requires LDAP or a local user'
        );
      }

      const localResult = userStore.verifyLocalUser(normalizedUserId, password);
      if (!localResult.ok) {
        return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
      }
      return res.json(createAuthLoginResponse(normalizedUserId, {
        authType: 'local',
        user: {
          type: 'local',
          displayName: localResult.user.displayName || normalizedUserId,
          mail: localResult.user.mail || null,
          department: localResult.user.department || department || null
        }
      }));
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.get('/api/auth/session', (req, res) => {
    try {
      const token = getUserToken(req);
      const session = getValidUserSession(token);
      if (!session) {
        return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
      }

      res.json({
        ok: true,
        userName: session.userName,
        userType: session.userType,
        expiresAt: session.expiresAt
      });
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  router.post('/api/auth/logout', (req, res) => {
    try {
      const token = getUserToken(req);
      if (token) {
        const session = userSessions.get(token);
        if (session?.userName) {
          releaseLocksOwnedByUser(session.userName);
        }
        userSessions.delete(token);
      }
      res.status(204).send();
    } catch (err) {
      errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
