(function() {
  const USER_KEY = 'currentUser';
  const ACTIVE_SESSION_KEY = 'onlygantt_active_session';
  const sessionPasswords = new Map();

  function getHostnameKey() {
    return typeof window !== 'undefined' ? window.location.host.toLowerCase() : 'localhost';
  }

  function getPasswordsKey(userName) {
    const hostname = getHostnameKey();
    return `passwords_${userName}_${hostname}`;
  }

  function getCurrentUser() {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(USER_KEY) || '';
  }

  function setCurrentUser(userName) {
    if (typeof localStorage === 'undefined') return;
    if (userName) {
      localStorage.setItem(USER_KEY, userName);
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function getActiveSession() {
    try {
      if (typeof sessionStorage === 'undefined') return {};
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
      if (typeof sessionStorage === 'undefined') return;
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
      if (typeof sessionStorage === 'undefined') return;
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

  const storageObj = {
    getCurrentUser,
    setCurrentUser,
    getActiveSession,
    setActiveSession,
    clearActiveSession,
    getPassword,
    setPassword,
    removePassword,
    default: {
      getCurrentUser,
      setCurrentUser,
      getActiveSession,
      setActiveSession,
      clearActiveSession,
      getPassword,
      setPassword,
      removePassword
    }
  };

  if (typeof window !== 'undefined') {
    window.OnlyGantt = window.OnlyGantt || {};
    window.OnlyGantt.storage = storageObj;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = storageObj;
  }
})();
