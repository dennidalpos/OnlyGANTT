import storage from '../storage.js';

const { useState, useRef, useCallback } = React;

export function useAuth() {
  const restoredSessionRef = useRef(storage.getActiveSession());
  const restoredSession = restoredSessionRef.current || {};
  const initialUserToken = typeof restoredSession.userToken === 'string' ? restoredSession.userToken : null;
  const initialAdminToken = typeof restoredSession.adminToken === 'string' ? restoredSession.adminToken : null;
  const initialDept = (initialUserToken || initialAdminToken) && typeof restoredSession.department === 'string'
    ? restoredSession.department
    : null;

  const [userName, setUserName] = useState(restoredSession.userName || storage.getCurrentUser() || '');
  const [userToken, setUserToken] = useState(initialUserToken);
  const [adminToken, setAdminToken] = useState(initialAdminToken);
  const [department, setDepartment] = useState(initialDept);
  const [userPermissions, setUserPermissions] = useState(restoredSession.userPermissions || {});
  const [readOnlyDepartment, setReadOnlyDepartment] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [isDepartmentProtected, setIsDepartmentProtected] = useState(false);
  const [loginError, setLoginError] = useState('');

  const effectiveUserName = adminToken ? (userName || 'admin') : userName;
  const isAuthenticated = !!(userToken || adminToken);

  const logout = useCallback(() => {
    setUserToken(null);
    setAdminToken(null);
    setDepartment(null);
    setUserPermissions({});
    setReadOnlyDepartment(false);
    storage.clearSession();
  }, []);

  return {
    userName,
    setUserName,
    userToken,
    setUserToken,
    adminToken,
    setAdminToken,
    department,
    setDepartment,
    userPermissions,
    setUserPermissions,
    readOnlyDepartment,
    setReadOnlyDepartment,
    lockEnabled,
    setLockEnabled,
    isDepartmentProtected,
    setIsDepartmentProtected,
    loginError,
    setLoginError,
    effectiveUserName,
    isAuthenticated,
    logout
  };
}

export default useAuth;
