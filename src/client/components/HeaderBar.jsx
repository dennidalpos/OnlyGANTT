



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
    onAdminChangePassword
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

    
    const lockStatus = lockEnabled && isLocked
      ? { icon: '🔒', label: 'Lock', className: 'status-lock--active' }
      : lockInfo?.locked
        ? { icon: '🔒', label: lockInfo.lockedBy, className: 'status-lock--other' }
        : { icon: '🔓', label: 'Libero', className: 'status-lock--free' };

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
              <span className={`topbar__status-item ${lockStatus.className}`} title={`Lock: ${lockStatus.label}`}>
                <span className="topbar__status-icon">{lockStatus.icon}</span>
                <span className="topbar__status-text">{lockStatus.label}</span>
              </span>
            )}
            {adminToken && (
              <span className="topbar__status-item status-admin" title="Modalità amministratore">
                <span className="topbar__status-icon">⚙</span>
                <span className="topbar__status-text">Admin</span>
              </span>
            )}
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
                  disabled={!department || lockEnabled}
                >
                  Modifica reparto
                </button>
                <button
                  className="topbar__dropdown-item"
                  onClick={() => handleMenuAction(onReleaseLock)}
                  disabled={!department || !lockEnabled}
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
