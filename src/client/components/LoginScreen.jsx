



(function() {
  'use strict';

  const { useState, useEffect, useCallback, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const api = window.OnlyGantt.api;
  const storage = window.OnlyGantt.storage;

  function LoginScreen({
    userName,
    onUserNameChange,
    onDepartmentChange,
    adminToken,
    onAdminLogin,
    onAdminLogout,
    onUserTokenChange,
    loginError,
    setLoginError
  }) {
    
    const [activeTab, setActiveTab] = useState(adminToken ? 'admin' : 'user');
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [deptPassword, setDeptPassword] = useState('');
    const [pendingUserName, setPendingUserName] = useState(userName || '');
    const [userPassword, setUserPassword] = useState('');
    const [authConfig, setAuthConfig] = useState({ ldapEnabled: false, localFallback: false, localUsers: 0 });
    const [authLoading, setAuthLoading] = useState(true);
    const [adminId, setAdminId] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingDepts, setLoadingDepts] = useState(true);
    const [showAdminPasswordReset, setShowAdminPasswordReset] = useState(false);
    const [adminResetCode, setAdminResetCode] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');

    
    const userNameRef = useRef(null);
    const deptSelectRef = useRef(null);
    const deptPasswordRef = useRef(null);
    const userPasswordRef = useRef(null);
    const adminIdRef = useRef(null);
    const adminPasswordRef = useRef(null);

    
    const loadDepartments = useCallback(async (signal) => {
      setLoadingDepts(true);
      try {
        const data = await api.getDepartments(signal);
        setDepartments(data.departments || []);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError('Impossibile caricare i reparti');
      } finally {
        setLoadingDepts(false);
      }
    }, []);

    useEffect(() => {
      const controller = new AbortController();
      loadDepartments(controller.signal);
      return () => controller.abort();
    }, [loadDepartments]);

    useEffect(() => {
      const controller = new AbortController();
      const loadAuthConfig = async () => {
        setAuthLoading(true);
        try {
          const data = await api.getAuthConfig(controller.signal);
          setAuthConfig({
            ldapEnabled: !!data.ldapEnabled,
            localFallback: !!data.localFallback,
            localUsers: data.localUsers || 0
          });
        } catch (err) {
          if (err.name === 'AbortError') return;
          setAuthConfig({ ldapEnabled: false, localFallback: false, localUsers: 0 });
        } finally {
          setAuthLoading(false);
        }
      };
      loadAuthConfig();
      return () => controller.abort();
    }, []);

    
    useEffect(() => {
      setPendingUserName(userName || '');
      setUserPassword('');
    }, [userName]);

    
    useEffect(() => {
      if (selectedDept && userName) {
        const saved = storage.getPassword(userName, selectedDept);
        setDeptPassword(saved || '');
      } else {
        setDeptPassword('');
      }
    }, [selectedDept, userName]);

    
    useEffect(() => {
      setError('');
      if (activeTab === 'user') {
        if (!userName || userName.length < 2) {
          userNameRef.current?.focus();
        } else {
          deptSelectRef.current?.focus();
        }
      } else if (activeTab === 'admin' && !adminToken) {
        adminIdRef.current?.focus();
      }
    }, [activeTab, adminToken, userName]);

    
    const selectedDeptObj = departments.find(d => d.name === selectedDept);
    const isUserNameValid = pendingUserName.trim().length >= 2;
    const hasDepartments = departments.length > 0;
    const needsPassword = selectedDeptObj?.protected && !adminToken;
    const requiresUserPassword = !adminToken && (authConfig.ldapEnabled || authConfig.localUsers > 0);

    
    const canSubmitDept = Boolean(
      selectedDeptObj &&
      (adminToken || isUserNameValid) &&
      (!needsPassword || deptPassword) &&
      (!requiresUserPassword || userPassword) &&
      !authLoading &&
      !isLoading
    );

    
    const canSubmitAdmin = Boolean(
      adminId.trim() &&
      adminPassword &&
      !isLoading
    );

    
    const handleUserNameBlur = () => {
      if (pendingUserName !== userName) {
        onUserNameChange(pendingUserName.trim());
      }
    };

    const handleUserNameKeyDown = (e) => {
      if (e.key === 'Tab' && !e.shiftKey && requiresUserPassword) {
        e.preventDefault();
        userPasswordRef.current?.focus();
        return;
      }
      if (e.key === 'Enter') {
        handleUserNameBlur();
        if (isUserNameValid) {
          deptSelectRef.current?.focus();
        }
      }
    };

    const handleDeptSelectKeyDown = (e) => {
      if (e.key === 'Enter' && selectedDept) {
        if (needsPassword) {
          deptPasswordRef.current?.focus();
        } else {
          handleDeptLogin();
        }
      }
    };

    const handleDeptPasswordKeyDown = (e) => {
      if (e.key === 'Enter' && canSubmitDept) {
        handleDeptLogin();
      }
    };

    const handleUserPasswordKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (selectedDept) {
          handleDeptLogin();
        } else {
          deptSelectRef.current?.focus();
        }
      }
    };

    const handleAdminIdKeyDown = (e) => {
      if (e.key === 'Enter') {
        adminPasswordRef.current?.focus();
      }
    };

    const handleAdminPasswordKeyDown = (e) => {
      if (e.key === 'Enter' && canSubmitAdmin) {
        handleAdminLogin();
      }
    };

    const handleDeptLogin = async () => {
      if (!selectedDept) {
        setError('Seleziona un reparto');
        deptSelectRef.current?.focus();
        return;
      }

      if (!adminToken && !isUserNameValid) {
        setError('Inserisci un nome utente valido (min. 2 caratteri)');
        userNameRef.current?.focus();
        return;
      }

      if (requiresUserPassword && !userPassword) {
        setError('Inserisci la password utente');
        userPasswordRef.current?.focus();
        return;
      }

      if (authLoading) {
        setError('Configurazione autenticazione in caricamento');
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        let authResult = null;
        if (!adminToken && requiresUserPassword) {
          authResult = await api.authLogin(pendingUserName.trim(), userPassword, selectedDept);
        }

        if (authResult?.token) {
          onUserTokenChange(authResult.token);
        }

        if (needsPassword) {
          const result = await api.verifyPassword(selectedDept, deptPassword);
          if (!result.ok) {
            setError('Password reparto errata');
            setDeptPassword('');
            deptPasswordRef.current?.focus();
            setIsLoading(false);
            return;
          }
          
          storage.setPassword(pendingUserName.trim(), selectedDept, deptPassword);
        }

        
        if (pendingUserName.trim() !== userName) {
          onUserNameChange(pendingUserName.trim());
        }

        setUserPassword('');
        onDepartmentChange(selectedDept);
      } catch (err) {
        if (err.code === 'LDAP_DOWN') {
          setError('Server LDAP non disponibile');
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Credenziali non valide');
        } else if (err.code === 'GROUP_REQUIRED') {
          setError('Utente non presente nel gruppo richiesto');
        } else if (err.code === 'ADMIN_LOCAL_ONLY') {
          setError('Accesso admin consentito solo localmente');
        } else {
          setError(err.message || 'Errore durante l\'accesso');
        }
      } finally {
        setIsLoading(false);
      }
    };

    const handleAdminLogin = async () => {
      if (!adminId.trim()) {
        setError('Inserisci l\'ID admin');
        adminIdRef.current?.focus();
        return;
      }

      if (!adminPassword) {
        setError('Inserisci la password admin');
        adminPasswordRef.current?.focus();
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        await onAdminLogin(adminId.trim(), adminPassword);
        
        setAdminId('');
        setAdminPassword('');
      } catch (err) {
        setError(err.message || 'Credenziali admin non valide');
        setAdminPassword('');
        adminPasswordRef.current?.focus();
      } finally {
        setIsLoading(false);
      }
    };

    const handleAdminLogout = () => {
      onAdminLogout();
      setActiveTab('user');
    };

    const handleTabChange = (tab) => {
      setActiveTab(tab);
      setError('');
    };

    const handleAdminPasswordReset = async () => {
      if (!adminResetCode || !newAdminPassword) {
        setError('Inserisci codice reset e nuova password');
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        await api.adminResetPassword(adminResetCode, newAdminPassword);
        setAdminResetCode('');
        setNewAdminPassword('');
        setShowAdminPasswordReset(false);
        setError('');
        alert('Password admin reimpostata con successo. Usa le nuove credenziali per accedere.');
      } catch (err) {
        setError(err.message || 'Codice reset non valido');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">OnlyGANTT</h1>
            <p className="login-subtitle">Accedi per gestire i progetti</p>
          </div>

          {}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${activeTab === 'user' ? 'active' : ''}`}
              onClick={() => handleTabChange('user')}
              disabled={isLoading}
            >
              <span className="login-tab-icon">&#128100;</span>
              <span className="login-tab-label">Reparto</span>
            </button>
            <button
              type="button"
              className={`login-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => handleTabChange('admin')}
              disabled={isLoading}
            >
              <span className="login-tab-icon">&#128274;</span>
              <span className="login-tab-label">Admin</span>
            </button>
          </div>

          {}
          {error && (
            <div className="login-error">
              <span className="login-error-icon">!</span>
              <span className="login-error-text">{error}</span>
            </div>
          )}

          {}
          {activeTab === 'user' && (
            <div className="login-form">
              <div className="login-section">
                <div className="login-section-header">
                  <span className="login-section-number">1</span>
                  <span className="login-section-title">Identificati</span>
                </div>
                <div className="form-group">
                  <label htmlFor="login-username">Nome utente</label>
                  <input
                    ref={userNameRef}
                    id="login-username"
                    type="text"
                    value={pendingUserName}
                    onChange={(e) => setPendingUserName(e.target.value)}
                    onBlur={handleUserNameBlur}
                    onKeyDown={handleUserNameKeyDown}
                    placeholder="Il tuo nome (min. 2 caratteri)"
                    disabled={isLoading}
                    autoComplete="username"
                    className={!isUserNameValid && pendingUserName ? 'input-warning' : ''}
                  />
                  {!isUserNameValid && pendingUserName && (
                    <span className="input-hint warning">Inserisci almeno 2 caratteri</span>
                  )}
                  {isUserNameValid && (
                    <span className="input-hint success">Nome valido</span>
                  )}
                </div>
                {requiresUserPassword && (
                  <div className="form-group">
                    <label htmlFor="login-user-password">Password utente</label>
                    <input
                      ref={userPasswordRef}
                      id="login-user-password"
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      onKeyDown={handleUserPasswordKeyDown}
                      placeholder="Inserisci password utente"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    {authConfig.ldapEnabled && (
                      <span className="input-hint">Autenticazione LDAP attiva</span>
                    )}
                  </div>
                )}
              </div>

              <div className="login-section">
                <div className="login-section-header">
                  <span className="login-section-number">2</span>
                  <span className="login-section-title">Seleziona reparto</span>
                </div>
                <div className="form-group">
                  <label htmlFor="login-department">Reparto</label>
                  {loadingDepts ? (
                    <div className="login-loading-inline">Caricamento reparti...</div>
                  ) : (
                    <select
                      ref={deptSelectRef}
                      id="login-department"
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      onKeyDown={handleDeptSelectKeyDown}
                      disabled={isLoading || !hasDepartments}
                    >
                      <option value="">-- Seleziona reparto --</option>
                      {departments.map(d => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                          {d.protected ? ' (protetto)' : ''}
                          {d.readOnly ? ' [sola lettura]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {!hasDepartments && !loadingDepts && (
                    <span className="input-hint warning">
                      Nessun reparto disponibile. Contatta un admin.
                    </span>
                  )}
                </div>

                {needsPassword && (
                  <div className="form-group">
                    <label htmlFor="login-dept-password">Password reparto</label>
                    <input
                      ref={deptPasswordRef}
                      id="login-dept-password"
                      type="password"
                      value={deptPassword}
                      onChange={(e) => setDeptPassword(e.target.value)}
                      onKeyDown={handleDeptPasswordKeyDown}
                      placeholder="Inserisci password"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className="login-submit btn-success"
                onClick={handleDeptLogin}
                disabled={!canSubmitDept}
              >
                {isLoading ? 'Accesso in corso...' : 'Accedi al reparto'}
              </button>
            </div>
          )}

          {}
          {activeTab === 'admin' && (
            <div className="login-form">
              {adminToken ? (
                <div className="login-admin-active">
                  <div className="login-admin-status">
                    <span className="login-admin-badge">Admin attivo</span>
                    <p className="login-admin-info">
                      Hai accesso amministrativo. Seleziona un reparto per gestirlo.
                    </p>
                  </div>

                  <div className="login-section">
                    <div className="login-section-header">
                      <span className="login-section-number">1</span>
                      <span className="login-section-title">Seleziona reparto</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="login-admin-department">Reparto</label>
                      {loadingDepts ? (
                        <div className="login-loading-inline">Caricamento reparti...</div>
                      ) : (
                        <select
                          ref={deptSelectRef}
                          id="login-admin-department"
                          value={selectedDept}
                          onChange={(e) => setSelectedDept(e.target.value)}
                          onKeyDown={handleDeptSelectKeyDown}
                          disabled={isLoading || !hasDepartments}
                        >
                          <option value="">-- Seleziona reparto --</option>
                          {departments.map(d => (
                            <option key={d.name} value={d.name}>
                              {d.name}
                              {d.readOnly ? ' [sola lettura]' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="login-actions-row">
                    <button
                      type="button"
                      className="login-submit btn-success"
                      onClick={handleDeptLogin}
                      disabled={!selectedDept || isLoading}
                    >
                      {isLoading ? 'Accesso...' : 'Apri reparto'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAdminLogout}
                      disabled={isLoading}
                    >
                      Esci da admin
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="login-section">
                    <div className="login-section-header">
                      <span className="login-section-number">1</span>
                      <span className="login-section-title">Credenziali admin</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="login-admin-id">ID Admin</label>
                      <input
                        ref={adminIdRef}
                        id="login-admin-id"
                        type="text"
                        value={adminId}
                        onChange={(e) => setAdminId(e.target.value)}
                        onKeyDown={handleAdminIdKeyDown}
                        placeholder="Inserisci ID admin"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="login-admin-password">Password Admin</label>
                      <input
                        ref={adminPasswordRef}
                        id="login-admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={handleAdminPasswordKeyDown}
                        placeholder="Inserisci password admin"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="login-submit btn-success"
                    onClick={handleAdminLogin}
                    disabled={!canSubmitAdmin}
                  >
                    {isLoading ? 'Autenticazione...' : 'Accedi come admin'}
                  </button>

                  {}
                  <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      onClick={() => setShowAdminPasswordReset(!showAdminPasswordReset)}
                      disabled={isLoading}
                    >
                      {showAdminPasswordReset ? 'Nascondi reset password' : 'Password dimenticata?'}
                    </button>

                    {showAdminPasswordReset && (
                      <div style={{ marginTop: 'var(--spacing-md)' }}>
                        <div className="login-section">
                          <div className="login-section-header">
                            <span className="login-section-title" style={{ fontSize: '0.8rem' }}>Reset Password Admin</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                            Usa il codice di reset fornito dall'amministratore di sistema (variabile ambiente ONLYGANTT_ADMIN_RESET_CODE).
                          </p>
                          <div className="form-group">
                            <label htmlFor="admin-reset-code">Codice Reset</label>
                            <input
                              id="admin-reset-code"
                              type="text"
                              value={adminResetCode}
                              onChange={(e) => setAdminResetCode(e.target.value)}
                              placeholder="Inserisci codice reset"
                              disabled={isLoading}
                              autoComplete="off"
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="new-admin-password">Nuova Password Admin</label>
                            <input
                              id="new-admin-password"
                              type="password"
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                              placeholder="Inserisci nuova password"
                              disabled={isLoading}
                              autoComplete="new-password"
                            />
                          </div>
                          <button
                            type="button"
                            className="login-submit btn-success"
                            onClick={handleAdminPasswordReset}
                            disabled={!adminResetCode || !newAdminPassword || isLoading}
                          >
                            {isLoading ? 'Resettando...' : 'Reimposta Password'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="login-footer">
            <span className="login-footer-text">OnlyGANTT - Timeline Progetti</span>
          </div>
        </div>
      </div>
    );
  }

  window.OnlyGantt.components.LoginScreen = LoginScreen;
})();
