(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const BASE_URL = '';
  let userToken = null;

  function setUserToken(token) {
    userToken = token || null;
  }

  function getUserToken() {
    return userToken;
  }

  function buildUserHeaders(headers = {}) {
    if (!userToken) return headers;
    return {
      ...headers,
      'X-User-Token': userToken
    };
  }

  function buildUserPayload(payload = {}) {
    if (!userToken) return payload;
    return {
      ...payload,
      userToken
    };
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(BASE_URL + url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(data?.error?.message || 'Request failed');
      error.status = response.status;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      error.data = data;
      throw error;
    }

    return data || {};
  }

  async function getDepartments(signal) {
    return fetchJSON('/api/departments', { signal });
  }

  async function getAuthConfig(signal) {
    return fetchJSON('/api/auth/config', { signal });
  }

  async function authLogin(userId, password, department, signal) {
    return fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId, password, department }),
      signal
    });
  }

  async function createDepartment(name, adminToken, signal) {
    return fetchJSON('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function deleteDepartment(name, adminToken, signal) {
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

  async function exportDepartment(name, signal) {
    return fetchJSON(`/api/departments/${encodeURIComponent(name)}/export`, { signal });
  }

  async function importDepartment(name, data, userName, signal) {
    return fetchJSON(`/api/departments/${encodeURIComponent(name)}/import`, {
      method: 'POST',
      body: JSON.stringify(buildUserPayload({ data, userName })),
      headers: buildUserHeaders(),
      signal
    });
  }

  async function verifyPassword(department, password, signal) {
    return fetchJSON(`/api/departments/${encodeURIComponent(department)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ password }),
      signal
    });
  }

  async function changePassword(department, oldPassword, newPassword, signal) {
    return fetchJSON(`/api/departments/${encodeURIComponent(department)}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
      signal
    });
  }

  async function resetPassword(department, newPassword, adminToken, signal) {
    return fetchJSON(`/api/departments/${encodeURIComponent(department)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function getProjects(department, signal) {
    return fetchJSON(`/api/projects/${encodeURIComponent(department)}`, { signal });
  }

  async function saveProjects(department, projects, expectedRevision, userName, signal) {
    return fetchJSON(`/api/projects/${encodeURIComponent(department)}`, {
      method: 'POST',
      body: JSON.stringify(buildUserPayload({ projects, expectedRevision, userName })),
      headers: buildUserHeaders(),
      signal
    });
  }

  async function uploadJSON(department, file, userName, signal) {
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
      throw error;
    }

    return data;
  }

  async function acquireLock(department, userName, clientHost, signal) {
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
      throw error;
    }

    return data;
  }

  async function releaseLock(department, userName) {
    await fetch(`${BASE_URL}/api/lock/${encodeURIComponent(department)}/release`, {
      method: 'POST',
      headers: buildUserHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(buildUserPayload({ userName }))
    });
  }

  async function getLockStatus(department, signal) {
    return fetchJSON(`/api/lock/${encodeURIComponent(department)}/status`, { signal });
  }

  async function heartbeatLock(department, userName, signal) {
    await fetch(`${BASE_URL}/api/lock/${encodeURIComponent(department)}/heartbeat`, {
      method: 'POST',
      headers: buildUserHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(buildUserPayload({ userName })),
      signal
    });
  }

  async function adminReleaseLock(department, token, signal) {
    await fetchJSON(`/api/lock/${encodeURIComponent(department)}/admin-release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function adminLogin(userId, password, signal) {
    return fetchJSON('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ userId, password }),
      signal
    });
  }

  async function getSystemConfig(token, signal) {
    return fetchJSON('/api/admin/system-config', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function getSystemStatus(token, signal) {
    return fetchJSON('/api/admin/system-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function updateSystemConfig(config, token, signal) {
    return fetchJSON('/api/admin/system-config', {
      method: 'POST',
      body: JSON.stringify(config),
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function testLdapConnection(config, testUserId, token, signal) {
    return fetchJSON('/api/admin/ldap/test', {
      method: 'POST',
      body: JSON.stringify({ config, testUserId }),
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function adminLogout(token, signal) {
    await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function getAdminDepartments(token, signal) {
    return fetchJSON('/api/admin/departments', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function getAdminUsers(token, signal) {
    return fetchJSON('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
  }

  async function adminResetPassword(resetCode, newPassword, signal) {
    return fetchJSON('/api/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetCode, newPassword }),
      signal
    });
  }

  async function adminChangePassword(oldPassword, newPassword, adminToken, signal) {
    return fetchJSON('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function adminServerBackup(adminToken, signal) {
    const response = await fetch(`${BASE_URL}/api/admin/server-backup`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });

    if (!response.ok) {
      const data = await response.json();
      const error = new Error(data.error?.message || 'Server backup failed');
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }

    return response.json();
  }

  async function adminServerRestore(backup, overwriteExisting, adminToken, signal) {
    return fetchJSON('/api/admin/server-restore', {
      method: 'POST',
      body: JSON.stringify({ backup, overwriteExisting }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function adminServerRestart(adminToken, signal) {
    return fetchJSON('/api/admin/server-restart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function adminExportModules(modules, adminToken, signal) {
    return fetchJSON('/api/admin/export', {
      method: 'POST',
      body: JSON.stringify({ modules }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  async function adminImportModules(backup, modules, overwriteExisting, adminToken, signal) {
    return fetchJSON('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify({ backup, modules, overwriteExisting }),
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      signal
    });
  }

  window.OnlyGantt.api = {
    setUserToken,
    getUserToken,
    getDepartments,
    createDepartment,
    deleteDepartment,
    exportDepartment,
    importDepartment,
    verifyPassword,
    changePassword,
    resetPassword,
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
    adminLogin,
    adminLogout,
    getAdminDepartments,
    getAdminUsers,
    adminResetPassword,
    adminChangePassword,
    adminServerBackup,
    adminServerRestore,
    adminServerRestart,
    adminExportModules,
    adminImportModules,
    testLdapConnection,
    getSystemConfig,
    getSystemStatus,
    updateSystemConfig
  };
})();
