// HeaderBar component
// Exposed on window.OnlyGantt.components.HeaderBar

(function() {
  'use strict';

  const { useState, useEffect, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function HeaderBar({
    userName,
    onUserNameChange,
    department,
    onDepartmentChange,
    screensaverEnabled,
    onScreensaverToggle,
    lockInfo,
    isLocked,
    lockEnabled,
    onEnableLock,
    onReleaseLock,
    onUserLogout,
    onExportDepartment,
    onImportDepartment,
    canImportExport,
    readOnlyDepartment,
    adminToken,
    onAdminLogin,
    onAdminLogout,
    onAdminReleaseLock,
    onChangePassword
  }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showAdmin, setShowAdmin] = useState(false);
    const [adminId, setAdminId] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);
    const [pendingUserName, setPendingUserName] = useState(userName);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showPasswordPanel, setShowPasswordPanel] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const menuRef = useRef(null);
    const menuButtonRef = useRef(null);

    // Update clock every second
    useEffect(() => {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      setPendingUserName(userName);
    }, [userName]);

    useEffect(() => {
      if (!menuOpen) return;

      const handleClickOutside = (event) => {
        if (menuRef.current?.contains(event.target)) return;
        if (menuButtonRef.current?.contains(event.target)) return;
        setMenuOpen(false);
      };

      const handleEscape = (event) => {
        if (event.key === 'Escape') {
          setMenuOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [menuOpen]);

    const timeString = currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const DepartmentSelector = window.OnlyGantt.components.DepartmentSelector;

    const handleUserNameCommit = async () => {
      if (pendingUserName === userName) return;
      const ok = await onUserNameChange(pendingUserName);
      if (!ok) {
        setPendingUserName(userName);
      }
    };

    const handleMenuAction = (action) => {
      if (action) {
        action();
      }
      setMenuOpen(false);
    };

    const handleAdminSubmit = async () => {
      if (!adminId || !adminPassword) {
        setAdminError('Inserisci ID e password');
        return;
      }

      setAdminLoading(true);
      setAdminError('');

      try {
        await onAdminLogin(adminId, adminPassword);
        setAdminPassword('');
        setShowAdmin(false);
      } catch (err) {
        setAdminError(err.message || 'Accesso admin fallito');
      } finally {
        setAdminLoading(false);
      }
    };

    const handlePasswordSubmit = async () => {
      if (!department) return;
      if (!newPassword.trim()) {
        setPasswordError('Inserisci una nuova password');
        return;
      }

      setPasswordError('');
      setPasswordLoading(true);

      try {
        const ok = await onChangePassword({
          oldPassword,
          newPassword
        });

        if (ok) {
          setOldPassword('');
          setNewPassword('');
          setShowPasswordPanel(false);
        }
      } catch (err) {
        setPasswordError(err.message || 'Cambio password fallito');
      } finally {
        setPasswordLoading(false);
      }
    };

    return (
      <header className="app-header">
        <div className="header-compact">
          <div className="header-left">
            <div className="header-summary">
              <span>
                <strong>Reparto:</strong> {department || '—'}
              </span>
              <span className="header-summary-sep">|</span>
              <span>
                <strong>Utente:</strong> {userName || '—'}
              </span>
            </div>
          </div>

          <div className="header-center" />

          <div className="header-right header-actions">
            {adminToken && <span className="badge badge-success">Admin attivo</span>}
            <span className="header-time">⏱ {timeString}</span>
            <button
              ref={menuButtonRef}
              className="header-menu-button"
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="Apri menu"
            >
              ☰
            </button>

            {menuOpen && (
              <div ref={menuRef} className="header-menu-panel">
                <div className="header-menu-section">
                  <div className="header-menu-title">Accesso</div>
                  <div className="form-group">
                    <label htmlFor="menuUserName">Utente</label>
                    <input
                      id="menuUserName"
                      type="text"
                      value={pendingUserName}
                      onChange={(e) => setPendingUserName(e.target.value)}
                      onBlur={handleUserNameCommit}
                      onKeyDown={(e) => e.key === 'Enter' && handleUserNameCommit()}
                      placeholder="Inserisci nome"
                    />
                  </div>
                  {DepartmentSelector && (
                    <DepartmentSelector
                      userName={userName}
                      department={department}
                      onDepartmentChange={onDepartmentChange}
                      adminToken={adminToken}
                      lockInfo={lockInfo}
                      onAdminReleaseLock={onAdminReleaseLock}
                      compact
                    />
                  )}
                </div>

                <div className="header-menu-section">
                  <div className="header-menu-title">Azioni reparto</div>
                  <div className="header-menu-row">
                    <button
                      onClick={() => handleMenuAction(() => onDepartmentChange(null))}
                      className="btn-secondary btn-small"
                      disabled={!department}
                    >
                      Cambia reparto
                    </button>
                    <button
                      onClick={() => handleMenuAction(onEnableLock)}
                      className="btn-secondary btn-small"
                      disabled={!department || lockEnabled}
                    >
                      Modifica reparto
                    </button>
                  </div>
                  <div className="header-menu-row">
                    <button
                      onClick={() => setShowPasswordPanel(prev => !prev)}
                      className="btn-secondary btn-small"
                      disabled={!department || readOnlyDepartment}
                    >
                      Cambia password
                    </button>
                  </div>

                  {showPasswordPanel && (
                    <div className="header-menu-subpanel">
                      <div className="form-group">
                        <label>Vecchia password</label>
                        <input
                          type="password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Nuova password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      {passwordError && <div className="alert-item">{passwordError}</div>}
                      <div className="header-menu-row">
                        <button
                          onClick={handlePasswordSubmit}
                          className="btn-success btn-small"
                          disabled={passwordLoading}
                        >
                          {passwordLoading ? 'Salvataggio...' : 'Conferma'}
                        </button>
                        <button
                          onClick={() => {
                            setShowPasswordPanel(false);
                            setOldPassword('');
                            setNewPassword('');
                            setPasswordError('');
                          }}
                          className="btn-secondary btn-small"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="header-menu-row">
                    <button
                      onClick={() => handleMenuAction(onExportDepartment)}
                      className="btn-secondary btn-small"
                      disabled={!canImportExport}
                    >
                      Export
                    </button>
                    <label className={`btn-secondary btn-small ${!canImportExport ? 'disabled' : ''}`} style={{ cursor: canImportExport ? 'pointer' : 'not-allowed', margin: 0 }}>
                      Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          if (!canImportExport) return;
                          const file = e.target.files[0];
                          if (file) {
                            onImportDepartment(file);
                            e.target.value = '';
                          }
                        }}
                        style={{ display: 'none' }}
                        disabled={!canImportExport}
                      />
                    </label>
                  </div>
                </div>

                <div className="header-menu-section">
                  <div className="header-menu-title">Preferenze</div>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={screensaverEnabled}
                      onChange={(e) => onScreensaverToggle(e.target.checked)}
                    />
                    Screensaver
                  </label>
                </div>

                <div className="header-menu-section">
                  <div className="header-menu-title">Admin</div>
                  <div className="header-menu-row">
                    <button
                      onClick={() => setShowAdmin((prev) => !prev)}
                      className={adminToken ? 'btn-success btn-small' : 'btn-secondary btn-small'}
                    >
                      {adminToken ? 'Admin attivo' : 'Accesso admin'}
                    </button>
                    {adminToken && (
                      <button
                        onClick={() => handleMenuAction(onAdminLogout)}
                        className="btn-secondary btn-small"
                      >
                        Logout admin
                      </button>
                    )}
                  </div>

                  {showAdmin && (
                    <div className="header-menu-subpanel">
                      {adminToken ? (
                        <span className="badge badge-success">Sessione admin attiva</span>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>ID Admin</label>
                            <input
                              type="text"
                              value={adminId}
                              onChange={(e) => setAdminId(e.target.value)}
                              placeholder="admin"
                            />
                          </div>
                          <div className="form-group">
                            <label>Password</label>
                            <input
                              type="password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                            />
                          </div>
                          {adminError && (
                            <div className="alert-item">{adminError}</div>
                          )}
                          <button
                            onClick={handleAdminSubmit}
                            className="btn-success btn-small"
                            disabled={adminLoading}
                          >
                            {adminLoading ? 'Accesso...' : 'Entra'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="header-menu-section">
                      <button onClick={() => handleMenuAction(onUserLogout)} className="btn-secondary btn-small">
                        Logout
                      </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  window.OnlyGantt.components.HeaderBar = HeaderBar;
})();
