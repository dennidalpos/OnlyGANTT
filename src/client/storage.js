// LocalStorage utilities
// Exposed on window.OnlyGantt.storage

(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const USER_KEY = 'currentUser';

  /**
   * Get hostname key for password storage (includes port, lowercase)
   * @returns {string}
   */
  function getHostnameKey() {
    return window.location.host.toLowerCase();
  }

  /**
   * Get passwords key for current user and hostname
   * @param {string} userName
   * @returns {string}
   */
  function getPasswordsKey(userName) {
    const hostname = getHostnameKey();
    return `passwords_${userName}_${hostname}`;
  }

  // === User ===

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

  // === Passwords ===

  function getPasswords(userName) {
    if (!userName) return {};

    const key = getPasswordsKey(userName);
    const data = localStorage.getItem(key);

    if (!data) return {};

    try {
      return JSON.parse(data);
    } catch (err) {
      return {};
    }
  }

  function savePasswords(userName, passwords) {
    if (!userName) return;

    const key = getPasswordsKey(userName);
    localStorage.setItem(key, JSON.stringify(passwords));
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

  function clearAllPasswords(userName) {
    if (!userName) return;
    const key = getPasswordsKey(userName);
    localStorage.removeItem(key);
  }

  // Expose on namespace
  window.OnlyGantt.storage = {
    getCurrentUser,
    setCurrentUser,
    getPassword,
    setPassword,
    removePassword,
    clearAllPasswords
  };
})();
