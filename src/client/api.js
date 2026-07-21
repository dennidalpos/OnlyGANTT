const BASE_URL = '';
let userToken = null;
let adminToken = null;

function notifyUserSessionInvalid(error) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('onlygantt:user-session-invalid', {
      detail: {
        message: error?.message || 'Sessione utente non valida o scaduta',
        code: error?.code || 'UNAUTHORIZED'
      }
    }));
  }
}

export function setUserToken(token) {
  userToken = token || null;
}

export function getUserToken() {
  return userToken;
}

export function setAdminToken(token) {
  adminToken = token || null;
}

export function getAdminToken() {
  return adminToken;
}

export function buildUserHeaders(headers = {}) {
  const result = { ...headers };
  if (userToken) {
    result['X-User-Token'] = userToken;
  }
  if (adminToken) {
    result['Authorization'] = `Bearer ${adminToken}`;
  }
  return result;
}

export function buildUserPayload(payload = {}) {
  if (!userToken) return payload;
  return {
    ...payload,
    userToken
  };
}

export async function fetchJSON(url, options = {}) {
  const { userSession = false, ...fetchOptions } = options;
  const response = await fetch(BASE_URL + url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers
    }
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = null;
  const contentType = response.headers.get('Content-Type') || '';
  if (text && contentType.includes('application/json')) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.warn('Failed to parse response JSON:', err.message);
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error?.message || response.statusText || 'Request failed');
    error.status = response.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    error.data = data;
    if (userSession && response.status === 401 && error.code === 'UNAUTHORIZED') {
      notifyUserSessionInvalid(error);
    }
    throw error;
  }

  return data || {};
}

export async function getDepartments(signal) {
  return fetchJSON('/api/departments', { signal });
}

export async function getAuthConfig(signal) {
  return fetchJSON('/api/auth/config', { signal });
}

export async function authLogin(userId, password, department, signal) {
  return fetchJSON('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId, password, department }),
    signal
  });
}

export async function getAuthSession(signal) {
  return fetchJSON('/api/auth/session', {
    headers: buildUserHeaders(),
    signal
  });
}

export async function createDepartment(name, adminToken, signal) {
  return fetchJSON('/api/departments', {
    method: 'POST',
    body: JSON.stringify({ name }),
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function deleteDepartment(name, adminToken, signal) {
  const response = await fetch(`${BASE_URL}/api/departments/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });

  if (!response.ok && response.status !== 204) {
    const data = await response.json();
    const error = new Error(data.error?.message || 'Delete failed');
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
}

export async function exportDepartment(name, signal) {
  return fetchJSON(`/api/departments/${encodeURIComponent(name)}/export`, {
    headers: buildUserHeaders(),
    userSession: true,
    signal
  });
}

export async function importDepartment(name, data, userName, signal) {
  return fetchJSON(`/api/departments/${encodeURIComponent(name)}/import`, {
    method: 'POST',
    body: JSON.stringify(buildUserPayload({ data, userName })),
    headers: buildUserHeaders(),
    userSession: true,
    signal
  });
}

export async function verifyPassword(department, password, signal) {
  return fetchJSON(`/api/departments/${encodeURIComponent(department)}/verify`, {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: buildUserHeaders(),
    signal
  });
}

export async function changePassword(department, oldPassword, newPassword, signal) {
  return fetchJSON(`/api/departments/${encodeURIComponent(department)}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
    headers: buildUserHeaders(),
    signal
  });
}

export async function resetPassword(department, newPassword, adminToken, signal) {
  return fetchJSON(`/api/departments/${encodeURIComponent(department)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function getProjects(department, signal) {
  return fetchJSON(`/api/projects/${encodeURIComponent(department)}`, {
    headers: buildUserHeaders(),
    userSession: true,
    signal
  });
}

export async function saveProjects(department, projects, expectedRevision, userName, signal) {
  return fetchJSON(`/api/projects/${encodeURIComponent(department)}`, {
    method: 'POST',
    body: JSON.stringify(buildUserPayload({ projects, expectedRevision, userName })),
    headers: buildUserHeaders(),
    userSession: true,
    signal
  });
}

export async function uploadJSON(department, file, userName, signal) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userName', userName);
  if (userToken) {
    formData.append('userToken', userToken);
  }

  const response = await fetch(`${BASE_URL}/api/upload/${encodeURIComponent(department)}`, {
    method: 'POST',
    body: formData,
    headers: buildUserHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Upload failed');
    error.status = response.status;
    error.code = data.error?.code;
    error.details = data.error?.details;
    error.data = data;
    if (response.status === 401 && error.code === 'UNAUTHORIZED') {
      notifyUserSessionInvalid(error);
    }
    throw error;
  }

  return data;
}

export async function acquireLock(department, userName, clientHost, signal) {
  const response = await fetch(`${BASE_URL}/api/lock/${encodeURIComponent(department)}/acquire`, {
    method: 'POST',
    headers: buildUserHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(buildUserPayload({ userName, clientHost })),
    signal
  });

  const data = await response.json();

  if (response.status === 423) {
    const error = new Error('Department is locked by another user');
    error.status = 423;
    error.lockInfo = data;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Lock acquire failed');
    error.status = response.status;
    error.code = data.error?.code;
    if (response.status === 401 && error.code === 'UNAUTHORIZED') {
      notifyUserSessionInvalid(error);
    }
    throw error;
  }

  return data;
}

export async function releaseLock(department, userName) {
  return fetchJSON(`/api/lock/${encodeURIComponent(department)}/release`, {
    method: 'POST',
    headers: buildUserHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(buildUserPayload({ userName })),
    userSession: true
  });
}

export async function getLockStatus(department, signal) {
  return fetchJSON(`/api/lock/${encodeURIComponent(department)}/status`, { signal });
}

export async function heartbeatLock(department, userName, signal) {
  return fetchJSON(`/api/lock/${encodeURIComponent(department)}/heartbeat`, {
    method: 'POST',
    headers: buildUserHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(buildUserPayload({ userName })),
    userSession: true,
    signal
  });
}

export async function adminReleaseLock(department, token, signal) {
  await fetchJSON(`/api/lock/${encodeURIComponent(department)}/admin-release`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function adminLogin(userId, password, signal) {
  return fetchJSON('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
    signal
  });
}

export async function authLogout(signal) {
  await fetchJSON('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify(buildUserPayload({})),
    headers: buildUserHeaders(),
    userSession: true,
    signal
  });
}

export async function getSystemConfig(token, signal) {
  return fetchJSON('/api/admin/system-config', {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function getSystemStatus(token, signal) {
  return fetchJSON('/api/admin/system-status', {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function updateSystemConfig(config, token, signal) {
  return fetchJSON('/api/admin/system-config', {
    method: 'POST',
    body: JSON.stringify(config),
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function testLdapConnection(config, testUserId, token, signal) {
  return fetchJSON('/api/admin/ldap/test', {
    method: 'POST',
    body: JSON.stringify({ config, testUserId }),
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function adminLogout(token, signal) {
  await fetch(`${BASE_URL}/api/admin/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function getAdminDepartments(token, signal) {
  return fetchJSON('/api/admin/departments', {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function getAdminUsers(token, signal) {
  return fetchJSON('/api/admin/users', {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function saveLocalUser(user, token, signal) {
  return fetchJSON('/api/admin/users/local', {
    method: 'POST',
    body: JSON.stringify(user),
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function deleteLocalUser(userId, token, signal) {
  return fetchJSON(`/api/admin/users/local/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    signal
  });
}

export async function adminResetPassword(resetCode, newPassword, signal) {
  return fetchJSON('/api/admin/reset-password', {
    method: 'POST',
    body: JSON.stringify({ resetCode, newPassword }),
    signal
  });
}

export async function adminChangePassword(oldPassword, newPassword, adminToken, signal) {
  return fetchJSON('/api/admin/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function adminServerRestart(adminToken, signal) {
  return fetchJSON('/api/admin/server-restart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function adminExportModules(modules, adminToken, signal) {
  return fetchJSON('/api/admin/export', {
    method: 'POST',
    body: JSON.stringify({ modules }),
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function adminImportModules(backup, modules, overwriteExisting, adminToken, signal) {
  return fetchJSON('/api/admin/import', {
    method: 'POST',
    body: JSON.stringify({ backup, modules, overwriteExisting }),
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    signal
  });
}

export async function setupAdminPassword(password, signal) {
  return fetchJSON('/api/admin/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
    signal
  });
}

const api = {
  setUserToken,
  getUserToken,
  setAdminToken,
  getAdminToken,
  buildUserHeaders,
  buildUserPayload,
  fetchJSON,
  getDepartments,
  createDepartment,
  deleteDepartment,
  exportDepartment,
  importDepartment,
  verifyPassword,
  changePassword,
  resetPassword,
  setupAdminPassword,
  getProjects,
  saveProjects,
  uploadJSON,
  acquireLock,
  releaseLock,
  getLockStatus,
  heartbeatLock,
  adminReleaseLock,
  getAuthConfig,
  authLogin,
  getAuthSession,
  authLogout,
  adminLogin,
  adminLogout,
  getAdminDepartments,
  getAdminUsers,
  saveLocalUser,
  deleteLocalUser,
  adminResetPassword,
  adminChangePassword,
  adminServerRestart,
  adminExportModules,
  adminImportModules,
  testLdapConnection,
  getSystemConfig,
  getSystemStatus,
  updateSystemConfig
};

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.api = api;
}

export default api;
