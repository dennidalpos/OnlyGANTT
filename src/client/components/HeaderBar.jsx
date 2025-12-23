// HeaderBar component
// Exposed on window.OnlyGantt.components.HeaderBar

(function() {
  'use strict';

  const { useState, useEffect } = React;

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
    onAdminReleaseLock
  }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showAdmin, setShowAdmin] = useState(false);
    const [adminId, setAdminId] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);
    const [pendingUserName, setPendingUserName] = useState(userName);

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

    const timeString = currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = currentTime.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
    const DepartmentSelector = window.OnlyGantt.components.DepartmentSelector;

    const handleUserNameCommit = async () => {
      if (pendingUserName === userName) return;
      const ok = await onUserNameChange(pendingUserName);
      if (!ok) {
        setPendingUserName(userName);
      }
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

    return (
      <header className="app-header">
        <div className="header-grid">
          <div className="header-left">
            <h1 className="app-title">OnlyGANTT</h1>

            <div className="header-sections">
              <div className="header-section header-section-department">
                <div className="header-section-title">Reparto corrente</div>
                <div className="header-section-content">
                  <div className="header-department">
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
                  {adminToken && (
                    <div className="header-import-export">
                      <button
                        onClick={onExportDepartment}
                        className="btn-secondary btn-small header-button"
                        disabled={!canImportExport}
                        title="Export reparto completo (progetti + configurazione)"
                      >
                        Export Reparto
                      </button>
                      <label className={`btn-secondary btn-small header-button ${!canImportExport ? 'disabled' : ''}`} style={{ cursor: canImportExport ? 'pointer' : 'not-allowed', margin: 0 }}>
                        Import Reparto
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
                  )}
                </div>
              </div>

              {!adminToken && (
                <div className="header-section">
                  <div className="header-section-title">Nome utente</div>
                  <div className="header-section-content header-user-section">
                    <div className="form-group mb-0" style={{ width: '180px' }}>
                      <label htmlFor="userName">Nome utente</label>
                      <input
                        id="userName"
                        type="text"
                        value={pendingUserName}
                        onChange={(e) => setPendingUserName(e.target.value)}
                        onBlur={handleUserNameCommit}
                        onKeyDown={(e) => e.key === 'Enter' && handleUserNameCommit()}
                        placeholder="Inserisci nome"
                      />
                    </div>

                    <div className="header-user-actions">
                      {readOnlyDepartment ? (
                        lockEnabled ? (
                          lockInfo && lockInfo.locked ? (
                            <span className="badge badge-error">
                              Locked by {lockInfo.lockedBy}
                            </span>
                          ) : (
                            <span className="badge badge-warning">Read-Only</span>
                          )
                        ) : (
                          <div className="header-lock-group">
                            <span className="badge badge-secondary">Lock disattivo</span>
                            <button onClick={onEnableLock} className="btn-small btn-success header-button">
                              Modifica reparto
                            </button>
                          </div>
                        )
                      ) : isLocked ? (
                        <div className="header-lock-group">
                          <span className="badge badge-success">Lock attivo</span>
                          <button onClick={onReleaseLock} className="btn-small btn-secondary header-button">
                            Rilascia lock
                          </button>
                        </div>
                      ) : lockInfo && lockInfo.locked ? (
                        <span className="badge badge-error">
                          Locked by {lockInfo.lockedBy}
                        </span>
                      ) : (
                        <span className="badge badge-secondary">No lock</span>
                      )}

                      <button onClick={onUserLogout} className="btn-secondary btn-small header-button">
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="header-right">
            <div className="header-section header-admin-group">
              <div className="header-section-title">Accesso admin</div>
              <div className="header-section-content header-admin-actions">
                <button
                  onClick={() => setShowAdmin((prev) => !prev)}
                  className={adminToken ? 'btn-success header-button' : 'btn-secondary header-button'}
                >
                  {adminToken ? 'Admin attivo' : 'Accesso Admin'}
                </button>

                {adminToken && (
                  <>
                    <button
                      onClick={onAdminLogout}
                      className="btn-secondary btn-small header-button"
                    >
                      Logout admin
                    </button>
                  </>
                )}
              </div>

              {showAdmin && (
                <div className="admin-panel">
                  {adminToken ? (
                    <div className="admin-panel-row">
                      <span className="badge badge-success">Sessione admin attiva</span>
                      <div className="header-admin-tools">
                        <span className="text-muted">Strumenti admin attivi.</span>
                      </div>
                    </div>
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
                        className="btn-success header-button"
                        disabled={adminLoading}
                      >
                        {adminLoading ? 'Accesso...' : 'Entra'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="header-datetime">
              <label className={`checkbox-label header-screensaver-toggle${screensaverEnabled ? ' is-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={screensaverEnabled}
                  onChange={(e) => onScreensaverToggle(e.target.checked)}
                />
                Screensaver
              </label>
              <span className="datetime-time">{timeString}</span>
              <span className="datetime-date">{dateString}</span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  window.OnlyGantt.components.HeaderBar = HeaderBar;
})();
