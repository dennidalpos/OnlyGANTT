const crypto = require('crypto');

function createSessionService({ configService, userStore, lockStore, errorResponse, normalizeDepartmentName, hasDepartmentPassword }) {
  const adminTokens = new Map();
  const userSessions = new Map();
  const CONFIG = configService.CONFIG;

  const ROLE_LEVELS = {
    supervisor: 3,
    editor: 2,
    viewer: 1,
    none: 0
  };

  function getUserDepartmentRole(userName, department) {
    if (!userName || !department || !userStore) return 'none';
    const permissions = userStore.getUserDepartmentPermissions(userName);
    const normalizedDept = normalizeDepartmentName(department);
    if (!normalizedDept) return 'none';
    for (const key of Object.keys(permissions || {})) {
      if (key.toLowerCase() === normalizedDept.toLowerCase()) {
        const role = permissions[key];
        return ['supervisor', 'editor', 'viewer'].includes(role) ? role : 'none';
      }
    }
    return 'none';
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

  function releaseLocksOwnedByUser(userName) {
    if (!userName) return;
    for (const [department, lock] of lockStore.entries()) {
      if (lock?.ownerUserName === userName) {
        lockStore.remove(department);
      }
    }
  }

  function cleanupExpiredUserSessions() {
    const now = Date.now();
    for (const [token, session] of userSessions.entries()) {
      if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= now) {
        if (session?.userName) {
          releaseLocksOwnedByUser(session.userName);
        }
        userSessions.delete(token);
      }
    }
  }

  function revokeUserSessionsForUser(userName) {
    if (!userName) return;
    const normalizedUserName = userName.trim().toLowerCase();
    for (const [token, session] of userSessions.entries()) {
      if ((session?.userName || '').trim().toLowerCase() === normalizedUserName) {
        userSessions.delete(token);
      }
    }
    releaseLocksOwnedByUser(userName);
  }

  function createUserSession(userName, { userType = 'user', department = null } = {}) {
    const token = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIG.userSessionTtlHours * 60 * 60 * 1000);
    const normalizedDepartment = normalizeDepartmentName(department);
    userSessions.set(token, {
      userName,
      userType,
      department: normalizedDepartment,
      departmentGrants: [],
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    return token;
  }

  function createAuthLoginResponse(userId, { authType, sessionUserType = authType, user }) {
    revokeUserSessionsForUser(userId);
    const token = createUserSession(userId, {
      userType: sessionUserType,
      department: user?.department || null
    });
    return {
      ok: true,
      authType,
      token,
      user: {
        userId,
        ...user
      }
    };
  }

  function getUserToken(req) {
    return req.headers['x-user-token'] || req.body?.userToken || null;
  }

  function getBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
  }

  function validateUserSession(req, res, userName) {
    if (!userName || typeof userName !== 'string') {
      errorResponse(res, 400, 'INVALID_REQUEST', 'userName is required');
      return false;
    }

    const normalizedUserName = userName.trim();

    const adminToken = getBearerToken(req);
    if (isValidAdminToken(adminToken)) {
      const session = {
        userName: normalizedUserName || CONFIG.adminUser,
        userType: 'admin',
        department: null,
        departmentGrants: []
      };
      if (req.body && typeof req.body === 'object') {
        req.body.userName = normalizedUserName;
      }
      req.userSession = session;
      return session;
    }

    const token = getUserToken(req);
    if (!token) {
      errorResponse(res, 401, 'UNAUTHORIZED', 'User token required');
      return false;
    }

    cleanupExpiredUserSessions();
    const session = userSessions.get(token);
    if (!session || session.userName !== normalizedUserName) {
      errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
      return false;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      userSessions.delete(token);
      errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired user session');
      return false;
    }

    session.lastSeenAt = new Date().toISOString();
    session.expiresAt = new Date(Date.now() + CONFIG.userSessionTtlHours * 60 * 60 * 1000).toISOString();
    userSessions.set(token, session);

    if (req.body && typeof req.body === 'object') {
      req.body.userName = normalizedUserName;
    }

    req.userSession = session;
    return session;
  }

  function getValidUserSession(token) {
    if (!token) return null;

    cleanupExpiredUserSessions();
    const session = userSessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      userSessions.delete(token);
      return null;
    }

    session.lastSeenAt = new Date().toISOString();
    session.expiresAt = new Date(Date.now() + CONFIG.userSessionTtlHours * 60 * 60 * 1000).toISOString();
    userSessions.set(token, session);
    return session;
  }

  function requireAdmin(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'Admin authentication required');
    }
    if (!isValidAdminToken(token)) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired admin token');
    }
    next();
  }

  function getRequestPrincipal(req) {
    const userToken = getUserToken(req);
    const userSession = getValidUserSession(userToken);
    if (userSession) {
      return { type: userSession.userType === 'admin' ? 'admin' : 'user', session: userSession };
    }

    const adminToken = getBearerToken(req);
    if (isValidAdminToken(adminToken)) {
      return {
        type: 'admin',
        session: {
          userName: CONFIG.adminUser,
          userType: 'admin',
          department: null,
          departmentGrants: []
        }
      };
    }

    return null;
  }

  function sessionHasDepartmentScope(session, department) {
    if (!session?.department) return true;
    const scopedDepartment = normalizeDepartmentName(session.department);
    const requestedDepartment = normalizeDepartmentName(department);
    if (!scopedDepartment || !requestedDepartment) return false;
    if (scopedDepartment.toLowerCase() === requestedDepartment.toLowerCase()) return true;
    return Array.isArray(session?.departmentGrants) &&
      session.departmentGrants.some((item) => (
        typeof item === 'string' &&
        item.toLowerCase() === requestedDepartment.toLowerCase()
      ));
  }

  function sessionHasDepartmentGrant(session, department, data) {
    if (!hasDepartmentPassword(data)) return true;
    const requestedDepartment = normalizeDepartmentName(department);
    if (!requestedDepartment) return false;
    return Array.isArray(session?.departmentGrants) &&
      session.departmentGrants.some((item) => (
        typeof item === 'string' &&
        item.toLowerCase() === requestedDepartment.toLowerCase()
      ));
  }

  function grantDepartmentAccess(req, department) {
    const token = getUserToken(req);
    const session = getValidUserSession(token);
    const normalizedDepartment = normalizeDepartmentName(department);
    if (!session || !normalizedDepartment || session.userType === 'admin') {
      return;
    }
    if (!Array.isArray(session.departmentGrants)) {
      session.departmentGrants = [];
    }
    if (!session.departmentGrants.some((item) => item.toLowerCase() === normalizedDepartment.toLowerCase())) {
      session.departmentGrants.push(normalizedDepartment);
    }
  }

  function requireDepartmentAccess(req, res, department, data, requiredRole = 'viewer') {
    const normalizedDepartment = normalizeDepartmentName(department);
    if (!normalizedDepartment) {
      errorResponse(res, 400, 'INVALID_NAME', 'Invalid department name');
      return null;
    }

    const principal = getRequestPrincipal(req);
    if (!principal) {
      errorResponse(res, 401, 'UNAUTHORIZED', 'User session required');
      return null;
    }

    if (principal.type === 'admin') {
      req.userSession = principal.session;
      req.userRole = 'supervisor';
      return principal.session;
    }

    if (hasDepartmentPassword(data) && !sessionHasDepartmentGrant(principal.session, normalizedDepartment, data)) {
      errorResponse(res, 403, 'DEPARTMENT_PASSWORD_REQUIRED', 'Department password verification required');
      return null;
    }

    let role = getUserDepartmentRole(principal.session.userName, normalizedDepartment);
    if (role === 'none') {
      if (!hasDepartmentPassword(data) || sessionHasDepartmentGrant(principal.session, normalizedDepartment, data)) {
        role = 'editor';
      }
    }

    const currentLevel = ROLE_LEVELS[role] || 0;
    const requiredLevel = ROLE_LEVELS[requiredRole] || 1;

    if (currentLevel === 0) {
      errorResponse(res, 403, 'DEPARTMENT_FORBIDDEN', 'Access to department is not authorized for this user');
      return null;
    }

    if (currentLevel < requiredLevel) {
      errorResponse(res, 403, 'INSUFFICIENT_PERMISSIONS', `Operation requires ${requiredRole} role in department`);
      return null;
    }

    req.userSession = principal.session;
    req.userRole = role;
    return principal.session;
  }

  function startSessionCleanup(intervalMs = 60 * 1000) {
    return setInterval(cleanupExpiredUserSessions, intervalMs).unref?.();
  }

  return {
    adminTokens,
    userSessions,
    isValidAdminToken,
    releaseLocksOwnedByUser,
    cleanupExpiredUserSessions,
    revokeUserSessionsForUser,
    createUserSession,
    createAuthLoginResponse,
    getUserToken,
    getBearerToken,
    validateUserSession,
    getValidUserSession,
    requireAdmin,
    getRequestPrincipal,
    sessionHasDepartmentScope,
    sessionHasDepartmentGrant,
    grantDepartmentAccess,
    requireDepartmentAccess,
    startSessionCleanup
  };
}

module.exports = { createSessionService };
