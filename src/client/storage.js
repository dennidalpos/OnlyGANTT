(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const USER_KEY = 'currentUser';
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
    getPassword,
    setPassword,
    removePassword
  };
})();
