(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const USER_KEY = 'currentUser';
  const ACTIVE_SESSION_KEY = 'onlygantt_active_session';
  const sessionPasswords = new Map();

  function getHostnameKey() {
    return window.location.host.toLowerCase();
  }

  function getPasswordsKey(userName) {
    const hostname = getHostnameKey();
    return `passwords_${userName}_${hostname}`;
  }

  function getCurrentUser() {
    return localStorage.getItem(USER_KEY) || '';
  }

  function setCurrentUser(userName) {
    if (userName) {
      localStorage.setItem(USER_KEY, userName);
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function getActiveSession() {
    try {
      const rawSession = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      if (!rawSession) return {};

      const session = JSON.parse(rawSession);
      if (!session || typeof session !== 'object') return {};

      return {
        userName: typeof session.userName === 'string' ? session.userName : '',
        department: typeof session.department === 'string' ? session.department : null,
        userToken: typeof session.userToken === 'string' ? session.userToken : null,
        adminToken: typeof session.adminToken === 'string' ? session.adminToken : null
      };
    } catch {
      return {};
    }
  }

  function setActiveSession(session) {
    try {
      const nextSession = {
        userName: session?.userName || '',
        department: session?.department || null,
        userToken: session?.userToken || null,
        adminToken: session?.adminToken || null
      };

      if (!nextSession.userToken && !nextSession.adminToken && !nextSession.department) {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        return;
      }

      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(nextSession));
    } catch {}
  }

  function clearActiveSession() {
    try {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {}
  }

  function getPasswords(userName) {
    if (!userName) return {};
    const key = getPasswordsKey(userName);
    return { ...(sessionPasswords.get(key) || {}) };
  }

  function savePasswords(userName, passwords) {
    if (!userName) return;

    const key = getPasswordsKey(userName);
    sessionPasswords.set(key, { ...(passwords || {}) });
  }

  function getPassword(userName, department) {
    const passwords = getPasswords(userName);
    return passwords[department] || '';
  }

  function setPassword(userName, department, password) {
    const passwords = getPasswords(userName);
    passwords[department] = password;
    savePasswords(userName, passwords);
  }

  function removePassword(userName, department) {
    const passwords = getPasswords(userName);
    delete passwords[department];
    savePasswords(userName, passwords);
  }

  window.OnlyGantt.storage = {
    getCurrentUser,
    setCurrentUser,
    getActiveSession,
    setActiveSession,
    clearActiveSession,
    getPassword,
    setPassword,
    removePassword
  };
})();
