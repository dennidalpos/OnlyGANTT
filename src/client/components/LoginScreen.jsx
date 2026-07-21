import api from '../api.js';
import storage from '../storage.js';

const { useState, useEffect, useCallback, useRef } = React;

function getRequestedLoginTab() {
  try {
    const hash = window.location.hash.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    const requestedLogin = (searchParams.get('login') || searchParams.get('view') || '').toLowerCase();
    return hash === '#admin' || requestedLogin === 'admin' ? 'admin' : null;
  } catch {
    return null;
  }
}

export function LoginScreen({
  userName,
  onUserNameChange,
  onDepartmentChange,
  adminToken,
  onAdminLogin,
  onAdminLogout,
  onUserTokenChange,
  loginError,
  setLoginError,
  pushNotification,
  onNavigateSystemSettings,
  onNavigateUserManagement
}) {
  const [activeTab, setActiveTab] = useState(() => adminToken ? 'admin' : getRequestedLoginTab() || 'user');
  const [userIdInput, setUserIdInput] = useState(() => storage.getCurrentUser() || userName || '');
  const [userPasswordInput, setUserPasswordInput] = useState('');

  const [adminUserIdInput, setAdminUserIdInput] = useState('admin');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [setupPasswordInput, setSetupPasswordInput] = useState('');
  const [setupConfirmInput, setSetupConfirmInput] = useState('');

  const [adminResetCode, setAdminResetCode] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminReset, setShowAdminReset] = useState(false);

  const [departments, setDepartments] = useState([]);

  const [authConfig, setAuthConfig] = useState({
    ldapEnabled: false,
    localFallback: false,
    localUsers: 0,
    adminConfigured: false,
    adminManagedByEnv: false,
    adminResetEnabled: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const isUnmountingRef = useRef(false);

  const fetchAuthConfig = useCallback(async (signal) => {
    try {
      const config = await api.getAuthConfig(signal);
      if (!isUnmountingRef.current) {
        setAuthConfig(config);
      }
    } catch (err) {
      if (!isUnmountingRef.current && err.name !== 'AbortError') {
        console.warn('Failed to load auth config:', err.message);
      }
    }
  }, []);

  const fetchDepartments = useCallback(async (signal) => {
    try {
      const list = await api.getDepartments(signal);
      if (!isUnmountingRef.current) {
        setDepartments(list?.departments || []);
      }
    } catch (err) {
      if (!isUnmountingRef.current && err.name !== 'AbortError') {
        console.warn('Failed to load departments:', err.message);
      }
    }
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    const controller = new AbortController();

    fetchAuthConfig(controller.signal);
    fetchDepartments(controller.signal);

    return () => {
      isUnmountingRef.current = true;
      controller.abort();
    };
  }, [fetchAuthConfig, fetchDepartments]);

  const handleUserLogin = async (e) => {
    if (e) e.preventDefault();

    const trimmedUserId = userIdInput.trim();
    if (!trimmedUserId) {
      setLoginError('Inserisci un nome utente');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await api.authLogin(trimmedUserId, userPasswordInput);

      if (result.ok && result.token) {
        storage.setCurrentUser(trimmedUserId);
        onUserNameChange(trimmedUserId);

        if (onUserTokenChange) {
          onUserTokenChange(result.token);
        }

        if (result.user?.department) {
          const dept = typeof result.user.department === 'string' ? result.user.department : result.user.department?.name;
          if (dept) onDepartmentChange(dept);
        } else if (departments.length === 1) {
          const dept = typeof departments[0] === 'string' ? departments[0] : departments[0]?.name;
          if (dept) onDepartmentChange(dept);
        }
      }
    } catch (err) {
      if (!isUnmountingRef.current) {
        if (err.code === 'ADMIN_LOCAL_ONLY') {
          setLoginError('L\'account admin deve effettuare l\'accesso dalla scheda Amministrazione.');
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setLoginError('Credenziali non valide. Verificare nome utente e password.');
        } else if (err.code === 'GROUP_REQUIRED') {
          setLoginError(err.message || 'Accesso non consentito: utente non appartiene al gruppo richiesto.');
        } else if (err.code === 'USER_LOGIN_NOT_CONFIGURED') {
          setLoginError('L\'accesso utente richiede un server LDAP o un utente locale configurato dall\'amministratore.');
        } else if (err.code === 'LDAP_DOWN') {
          setLoginError('Server Active Directory non raggiungibile. Riprovare piu\' tardi.');
        } else {
          setLoginError(err.message || 'Errore durante l\'accesso');
        }
      }
    } finally {
      if (!isUnmountingRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAdminSetup = async (e) => {
    if (e) e.preventDefault();

    if (!setupPasswordInput) {
      setLoginError('Inserisci una password per l\'amministratore');
      return;
    }

    if (setupPasswordInput.length < 6) {
      setLoginError('La password deve contenere almeno 6 caratteri');
      return;
    }

    if (setupPasswordInput !== setupConfirmInput) {
      setLoginError('Le password non coincidono');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await api.setupAdminPassword(setupPasswordInput.trim());

      if (result.ok) {
        if (pushNotification) {
          pushNotification({ type: 'success', message: 'Password amministratore configurata con successo' });
        }

        setAuthConfig(prev => ({ ...prev, adminConfigured: true }));
        setAdminPasswordInput(setupPasswordInput.trim());

        const loginResult = await api.adminLogin('admin', setupPasswordInput.trim());
        if (loginResult.ok && loginResult.token) {
          onAdminLogin(loginResult.token);
        }
      }
    } catch (err) {
      if (!isUnmountingRef.current) {
        setLoginError(err.message || 'Errore durante la configurazione della password');
      }
    } finally {
      if (!isUnmountingRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    if (e) e.preventDefault();

    const trimmedAdminUser = adminUserIdInput.trim();
    if (!trimmedAdminUser) {
      setLoginError('Inserisci il nome utente amministratore');
      return;
    }

    if (!adminPasswordInput) {
      setLoginError('Inserisci la password amministratore');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await api.adminLogin(trimmedAdminUser, adminPasswordInput);

      if (result && result.token) {
        onAdminLogin(result.token);
        if (pushNotification) {
          pushNotification({ type: 'success', message: 'Accesso amministratore effettuato' });
        }
      }
    } catch (err) {
      if (!isUnmountingRef.current) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setLoginError('Credenziali amministratore non valide.');
        } else {
          setLoginError(err.message || 'Errore durante l\'accesso amministratore');
        }
      }
    } finally {
      if (!isUnmountingRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAdminPasswordReset = async (e) => {
    if (e) e.preventDefault();

    if (!adminResetCode.trim()) {
      setLoginError('Inserisci il codice di reset');
      return;
    }

    if (!newAdminPassword) {
      setLoginError('Inserisci la nuova password');
      return;
    }

    if (newAdminPassword.length < 6) {
      setLoginError('La nuova password deve contenere almeno 6 caratteri');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const resetPasswordValue = newAdminPassword.trim();
      const result = await api.adminResetPassword(adminResetCode.trim(), resetPasswordValue);

      if (result.ok) {
        setAdminResetCode('');
        setNewAdminPassword('');
        setShowAdminReset(false);
        setAdminPasswordInput(resetPasswordValue);

        const loginResult = await api.adminLogin(adminUserIdInput.trim() || 'admin', resetPasswordValue);
        if (loginResult.ok && loginResult.token) {
          onAdminLogin(loginResult.token);
          if (pushNotification) {
            pushNotification({ type: 'success', message: 'Password amministratore reimpostata e accesso effettuato' });
          }
        } else if (pushNotification) {
          pushNotification({ type: 'success', message: 'Password amministratore reimpostata con successo' });
        }
      }
    } catch (err) {
      if (!isUnmountingRef.current) {
        setLoginError(err.message || 'Codice di reset non valido o errore durante il ripristino');
      }
    } finally {
      if (!isUnmountingRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLoginError(null);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">OnlyGANTT</h1>
          <p className="login-subtitle">Gestione Timeline e Progetti Multi-Reparto</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => handleTabChange('user')}
          >
            Accesso Utente
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabChange('admin')}
          >
            Amministrazione
          </button>
        </div>

        {loginError && (
          <div className="login-error" role="alert">
            <span className="login-error-icon">⚠️</span>
            <span className="login-error-message">{loginError}</span>
          </div>
        )}

        <div className="login-body">
          {activeTab === 'user' ? (
            <form onSubmit={handleUserLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="login-username">Nome Utente</label>
                <input
                  id="login-username"
                  type="text"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  placeholder="es. mario.rossi o mrossi"
                  disabled={isLoading}
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={userPasswordInput}
                  onChange={(e) => setUserPasswordInput(e.target.value)}
                  placeholder="Password account"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="login-submit btn-success"
                disabled={isLoading || !userIdInput.trim()}
              >
                {isLoading ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </form>
          ) : (
            <div className="admin-login-area">
              {adminToken ? (
                <div className="admin-authenticated-banner" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div className="banner-info" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span className="banner-icon" style={{ fontSize: '1.5rem' }}>⚙️</span>
                    <strong style={{ fontSize: '1rem' }}>Sessione amministratore attiva</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {onNavigateSystemSettings && (
                      <button
                        type="button"
                        className="btn-success"
                        onClick={onNavigateSystemSettings}
                      >
                        ⚙️ Impostazioni di Sistema
                      </button>
                    )}
                    {onNavigateUserManagement && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={onNavigateUserManagement}
                      >
                        👥 Gestione Utenti
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-danger btn-small"
                    onClick={onAdminLogout}
                    style={{ width: '100%' }}
                  >
                    Chiudi sessione admin
                  </button>
                </div>
              ) : !authConfig.adminConfigured && !authConfig.adminManagedByEnv ? (
                <form onSubmit={handleAdminSetup} className="login-form">
                  <div className="login-info-box">
                    <strong>Configurazione Iniziale Amministratore</strong>
                    <p>Imposta la password per l'account amministrativo "admin".</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="setup-password">Nuova Password Admin</label>
                    <input
                      id="setup-password"
                      type="password"
                      value={setupPasswordInput}
                      onChange={(e) => setSetupPasswordInput(e.target.value)}
                      placeholder="Minimo 6 caratteri"
                      disabled={isLoading}
                      autoFocus
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="setup-confirm">Conferma Password</label>
                    <input
                      id="setup-confirm"
                      type="password"
                      value={setupConfirmInput}
                      onChange={(e) => setSetupConfirmInput(e.target.value)}
                      placeholder="Ripeti la password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="login-submit btn-success"
                    disabled={isLoading || !setupPasswordInput || setupPasswordInput.length < 6}
                  >
                    {isLoading ? 'Salvataggio...' : 'Configura e Accedi'}
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleAdminLoginSubmit} className="login-form">
                    <div className="form-group">
                      <label htmlFor="admin-username">Utente Amministratore</label>
                      <input
                        id="admin-username"
                        type="text"
                        value={adminUserIdInput}
                        onChange={(e) => setAdminUserIdInput(e.target.value)}
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="admin-password">Password Admin</label>
                      <input
                        id="admin-password"
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="Password amministratore"
                        disabled={isLoading}
                        autoFocus
                        autoComplete="current-password"
                      />
                    </div>

                    <button
                      type="submit"
                      className="login-submit btn-success"
                      disabled={isLoading || !adminPasswordInput}
                    >
                      {isLoading ? 'Accesso in corso...' : 'Accedi come Admin'}
                    </button>
                  </form>

                  <div className="admin-reset-area">
                    {authConfig.adminResetEnabled && !authConfig.adminManagedByEnv ? (
                      <>
                        <button
                          type="button"
                          className="btn-link-subtle"
                          onClick={() => setShowAdminReset(!showAdminReset)}
                        >
                          {showAdminReset ? 'Nascondi reset password' : 'Password admin dimenticata?'}
                        </button>

                        {showAdminReset && (
                          <div className="admin-reset-box">
                            <div className="form-group">
                              <label htmlFor="reset-code">Codice Reset Ambienza (ONLYGANTT_ADMIN_RESET_CODE)</label>
                              <input
                                id="reset-code"
                                type="text"
                                value={adminResetCode}
                                onChange={(e) => setAdminResetCode(e.target.value)}
                                placeholder="Codice di ripristino"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor="reset-new-password">Nuova Password Admin</label>
                              <input
                                id="reset-new-password"
                                type="password"
                                value={newAdminPassword}
                                onChange={(e) => setNewAdminPassword(e.target.value)}
                                placeholder="Minimo 6 caratteri"
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
                              {isLoading ? 'Reset in corso...' : 'Reimposta password'}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="input-hint" style={{ margin: 0 }}>
                        {authConfig.adminManagedByEnv
                          ? 'Reset password non disponibile: la password admin e\' gestita da variabili ambiente.'
                          : 'Reset password non disponibile: configurare ONLYGANTT_ADMIN_RESET_CODE per abilitarlo.'}
                      </p>
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
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.LoginScreen = LoginScreen;
}

export default LoginScreen;
