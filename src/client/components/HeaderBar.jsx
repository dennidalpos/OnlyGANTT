



(function() {
  'use strict';

  const { useState, useEffect, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function HeaderBar({
    userName,
    department,
    onDepartmentChange,
    lockInfo,
    isLocked,
    lockEnabled,
    onRefreshLock,
    onEnableLock,
    onReleaseLock,
    onUserLogout,
    onExportDepartment,
    onImportDepartment,
    canImportExport,
    readOnlyDepartment,
    adminToken,
    onChangePassword,
    onAdminCreateDepartment,
    onAdminDeleteDepartment,
    onAdminResetPassword,
    onAdminChangePassword,
    onAdminReleaseLock,
    onAdminServerBackup,
    onAdminServerRestore,
    screensaverEnabled,
    onToggleScreensaver
  }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const menuButtonRef = useRef(null);

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

    const handleMenuAction = (action) => {
      if (action) {
        action();
      }
      setMenuOpen(false);
    };

    const handlePasswordChange = async () => {
      if (!department || readOnlyDepartment) return;
      const oldPasswordInput = prompt('Vecchia password (lascia vuoto se non richiesta)');
      if (oldPasswordInput === null) return;
      const newPasswordInput = prompt('Nuova password');
      if (newPasswordInput === null) return;
      if (!newPasswordInput.trim()) return;
      await onChangePassword({ oldPassword: oldPasswordInput, newPassword: newPasswordInput });
    };

    const handleAdminPasswordReset = async () => {
      if (!department || !adminToken) return;
      const newPasswordInput = prompt('Nuova password reparto (vuoto per rimuovere)');
      if (newPasswordInput === null) return;
      await onAdminResetPassword({ department, newPassword: newPasswordInput.trim() || null });
    };

    const handleAdminCreate = async () => {
      if (!adminToken) return;
      const name = prompt('Nome nuovo reparto');
      if (!name || !name.trim()) return;
      const password = prompt('Password reparto (opzionale)');
      if (password === null) return;
      await onAdminCreateDepartment({ name: name.trim(), password: password.trim() || null });
    };

    const handleAdminDelete = async () => {
      if (!adminToken || !department) return;
      const confirmDelete = confirm(`Eliminare il reparto ${department}?`);
      if (!confirmDelete) return;
      await onAdminDeleteDepartment({ department });
    };

    const handleAdminChangePassword = async () => {
      if (!adminToken) return;
      const oldPasswordInput = prompt('Password admin attuale');
      if (oldPasswordInput === null) return;
      const newPasswordInput = prompt('Nuova password admin (minimo 6 caratteri)');
      if (newPasswordInput === null) return;
      if (!newPasswordInput.trim() || newPasswordInput.trim().length < 6) {
        alert('La password deve essere di almeno 6 caratteri');
        return;
      }
      await onAdminChangePassword({ oldPassword: oldPasswordInput, newPassword: newPasswordInput.trim() });
    };

    const handleAdminServerBackup = async () => {
      if (!adminToken) return;
      handleMenuAction(onAdminServerBackup);
    };

    const handleAdminServerRestore = async () => {
      if (!adminToken) return;
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          const overwrite = confirm(
            `Ripristinare il backup del server?\n\n` +
            `Reparti nel backup: ${backup.departments?.length || 0}\n` +
            `Data export: ${backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('it-IT') : 'N/A'}\n\n` +
            `ATTENZIONE: I reparti esistenti verranno sovrascritti!\n\n` +
            `Confermi il ripristino?`
          );

          if (overwrite) {
            await onAdminServerRestore({ backup, overwriteExisting: true });
          }
        } catch (err) {
          alert(`Errore nella lettura del file: ${err.message}`);
        }
      };
      fileInput.click();
      setMenuOpen(false);
    };

    const isLockedByOther = !!(lockInfo?.locked && !isLocked);

    const handleLockClick = () => {
      if (!department || readOnlyDepartment) return;

      if (isLocked) {
        handleMenuAction(onReleaseLock);
        return;
      }

      if (isLockedByOther) {
        if (lockEnabled) {
          handleMenuAction(onRefreshLock);
        } else {
          handleMenuAction(onEnableLock);
        }
        return;
      }

      handleMenuAction(onEnableLock);
    };

    const lockStatus = isLocked
      ? { icon: '🔒', label: 'Lock', className: 'status-lock--active', clickable: true, title: 'Clicca per liberare' }
      : isLockedByOther
        ? { icon: '🔒', label: lockInfo.lockedBy, className: 'status-lock--other', clickable: true, title: 'Clicca per richiedere modifica' }
        : { icon: '🔓', label: 'Libero', className: 'status-lock--free', clickable: true, title: 'Clicca per modificare' };

    return (
      <header className="topbar">
        {}
        <div className="topbar__left">
          <h1 className="topbar__title">OnlyGANTT</h1>
          {department && (
            <div className="topbar__context">
              <span className="topbar__context-item">
                <span className="topbar__context-label">Reparto:</span>
                <span className="topbar__context-value">{department}</span>
              </span>
              <span className="topbar__context-sep">|</span>
              <span className="topbar__context-item">
                <span className="topbar__context-label">Utente:</span>
                <span className="topbar__context-value">{userName || '—'}</span>
              </span>
            </div>
          )}
        </div>

        {}
        <div className="topbar__right">
          {}
          <div className="topbar__status">
            {department && (
              <button
                className={`topbar__status-item ${lockStatus.className} ${lockStatus.clickable ? 'clickable' : ''}`}
                title={lockStatus.clickable ? lockStatus.title : `Lock: ${lockStatus.label}`}
                onClick={lockStatus.clickable ? handleLockClick : undefined}
                disabled={!lockStatus.clickable || readOnlyDepartment}
                style={{ border: 'none', background: 'transparent', padding: '0.25rem 0.75rem', cursor: lockStatus.clickable && !readOnlyDepartment ? 'pointer' : 'default' }}
              >
                <span className="topbar__status-icon">{lockStatus.icon}</span>
                <span className="topbar__status-text">{lockStatus.label}</span>
              </button>
            )}
            {adminToken && (
              <span className="topbar__status-item status-admin" title="Modalità amministratore">
                <span className="topbar__status-icon">⚙</span>
                <span className="topbar__status-text">Admin</span>
              </span>
            )}
            <button
              className={`topbar__icon-btn ${screensaverEnabled ? 'active' : ''}`}
              onClick={onToggleScreensaver}
              title={screensaverEnabled ? 'Screensaver: ON (15s inattività)' : 'Screensaver: OFF'}
              aria-label={screensaverEnabled ? 'Disattiva screensaver' : 'Attiva screensaver'}
            >
              {screensaverEnabled ? '🌙' : '☀️'}
            </button>
          </div>

          {}
          <button
            ref={menuButtonRef}
            className="topbar__menu-btn"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Apri menu"
            aria-expanded={menuOpen}
          >
            <span className="topbar__menu-icon">☰</span>
          </button>

          {}
          {menuOpen && (
            <div ref={menuRef} className="topbar__dropdown">
              {}
              <div className="topbar__dropdown-section">
                <div className="topbar__dropdown-title">Reparto</div>
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(() => onDepartmentChange(null))}
                  disabled={!department}
                >
                  Cambia reparto
                </button>
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(onEnableLock)}
                  disabled={!department || lockEnabled || isLockedByOther}
                >
                  Modifica reparto
                </button>
                {isLockedByOther && (
                  <button
                    className="topbar__dropdown-item"
                    onClick={() => handleMenuAction(lockEnabled ? onRefreshLock : onEnableLock)}
                    disabled={!department}
                  >
                    Richiedi modifica
                  </button>
                )}
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(onReleaseLock)}
                  disabled={!department || !isLocked}
                >
                  Libera reparto
                </button>
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(handlePasswordChange)}
                  disabled={!department || readOnlyDepartment || adminToken}
                >
                  Cambia password
                </button>
              </div>

              {}
              {canImportExport && (
                <div className="topbar__dropdown-section">
                  <div className="topbar__dropdown-title">Dati</div>
                  <button
                    className="topbar__dropdown-item"
                    onClick={() => handleMenuAction(onExportDepartment)}
                  >
                    Export reparto
                  </button>
                  <label className="topbar__dropdown-item topbar__dropdown-item--file">
                    Import reparto
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleMenuAction(() => onImportDepartment(file));
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {}
              {adminToken && (
                <div className="topbar__dropdown-section">
                  <div className="topbar__dropdown-title">Admin</div>
                  <button
                    className="topbar__dropdown-item"
                    onClick={() => handleMenuAction(handleAdminCreate)}
                  >
                    Crea reparto
                  </button>
                  <button
                    className="topbar__dropdown-item"
                    onClick={() => handleMenuAction(handleAdminPasswordReset)}
                    disabled={!department}
                  >
                    Imposta password reparto
                  </button>
                  <button
                    className="topbar__dropdown-item"
                    onClick={() => handleMenuAction(handleAdminChangePassword)}
                  >
                    Cambia password admin
                  </button>
                  <button
                    className="topbar__dropdown-item topbar__dropdown-item--danger"
                    onClick={() => handleMenuAction(handleAdminDelete)}
                    disabled={!department}
                  >
                    Elimina reparto
                  </button>
                  <button
                    className="topbar__dropdown-item topbar__dropdown-item--danger"
                    onClick={() => handleMenuAction(onAdminReleaseLock)}
                    disabled={!department || !lockInfo?.locked || isLocked}
                  >
                    Sblocca reparto
                  </button>
                </div>
              )}

              {adminToken && (
                <div className="topbar__dropdown-section">
                  <div className="topbar__dropdown-title">Backup Server</div>
                  <button
                    className="topbar__dropdown-item"
                    onClick={handleAdminServerBackup}
                  >
                    Esporta backup completo
                  </button>
                  <button
                    className="topbar__dropdown-item"
                    onClick={handleAdminServerRestore}
                  >
                    Ripristina backup
                  </button>
                </div>
              )}

              {}
              <div className="topbar__dropdown-section">
                <div className="topbar__dropdown-title">Sessione</div>
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(onUserLogout)}
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
    );
  }

  window.OnlyGantt.components.HeaderBar = HeaderBar;
})();
