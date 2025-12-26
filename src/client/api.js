(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const BASE_URL = '';

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
      body: JSON.stringify({ data, userName }),
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
      body: JSON.stringify({ projects, expectedRevision, userName }),
      signal
    });
  }

  async function uploadJSON(department, file, userName, signal) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userName', userName);

    const response = await fetch(`${BASE_URL}/api/upload/${encodeURIComponent(department)}`, {
      method: 'POST',
      body: formData,
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userName, clientHost }),
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userName })
    });
  }

  async function getLockStatus(department, signal) {
    return fetchJSON(`/api/lock/${encodeURIComponent(department)}/status`, { signal });
  }

  async function heartbeatLock(department, userName, signal) {
    await fetch(`${BASE_URL}/api/lock/${encodeURIComponent(department)}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userName }),
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

  window.OnlyGantt.api = {
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
    adminLogin,
    adminLogout,
    getAdminDepartments,
    adminResetPassword,
    adminChangePassword
  };
})();
