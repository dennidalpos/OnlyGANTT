const { useState, useEffect, useRef } = React;

export function HeaderBar({
  userName,
  department,
  departments,
  userToken,
  onDepartmentChange,
  lockInfo,
  isLocked,
  lockEnabled,
  onRefreshLock,
  onEnableLock,
  onReleaseLock,
  onUserLogout,
  readOnlyDepartment,
  adminToken,
  onChangePassword,
  onAdminCreateDepartment,
  onAdminDeleteDepartment,
  onAdminResetPassword,
  onAdminChangePassword,
  onAdminReleaseLock,
  onNavigateSystemSettings,
  onNavigateUserManagement,
  dialogApi
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
    menuButtonRef.current?.focus();
  };

  const handlePasswordChange = async () => {
    if (!department || readOnlyDepartment || !dialogApi) return;
    const values = await dialogApi.form({
      title: 'Cambia password reparto',
      message: `Aggiorna la password del reparto ${department}.`,
      submitLabel: 'Aggiorna password',
      fields: [
        {
          name: 'oldPassword',
          label: 'Password attuale',
          type: 'password',
          helperText: 'Lascia vuoto se non richiesta.'
        },
        {
          name: 'newPassword',
          label: 'Nuova password',
          type: 'password',
          required: true,
          autoFocus: true
        }
      ]
    });
    if (!values) return;
    await onChangePassword({
      oldPassword: values.oldPassword || '',
      newPassword: (values.newPassword || '').trim()
    });
  };

  const handleAdminPasswordReset = async () => {
    if (!department || !adminToken || !dialogApi) return;
    const values = await dialogApi.form({
      title: 'Imposta password reparto',
      message: `Definisci la password del reparto ${department}. Lascia vuoto per rimuoverla.`,
      submitLabel: 'Salva password',
      fields: [
        {
          name: 'newPassword',
          label: 'Nuova password reparto',
          type: 'password',
          autoFocus: true
        }
      ]
    });
    if (!values) return;
    await onAdminResetPassword({ department, newPassword: (values.newPassword || '').trim() || null });
  };

  const handleAdminCreate = async () => {
    if (!adminToken || !dialogApi) return;
    const values = await dialogApi.form({
      title: 'Crea reparto',
      message: 'Inserisci il nome del nuovo reparto e, se serve, una password iniziale.',
      submitLabel: 'Crea reparto',
      fields: [
        {
          name: 'name',
          label: 'Nome reparto',
          required: true,
          autoFocus: true
        },
        {
          name: 'password',
          label: 'Password reparto iniziale',
          type: 'password',
          helperText: 'Opzionale.'
        }
      ]
    });
    if (!values) return;
    await onAdminCreateDepartment({
      name: values.name.trim(),
      password: (values.password || '').trim() || null
    });
  };

  const handleAdminDelete = async () => {
    if (!adminToken || !department || !dialogApi) return;
    const confirmDelete = await dialogApi.confirm({
      title: 'Elimina reparto',
      message: `Eliminare il reparto ${department}?`,
      confirmLabel: 'Elimina reparto',
      cancelLabel: 'Mantieni reparto',
      confirmTone: 'danger'
    });
    if (!confirmDelete) return;
    await onAdminDeleteDepartment({ department });
  };

  const handleAdminChangePassword = async () => {
    if (!adminToken || !dialogApi) return;
    const values = await dialogApi.form({
      title: 'Cambia password admin',
      message: 'Aggiorna la password dell\'account amministrativo.',
      submitLabel: 'Aggiorna password admin',
      fields: [
        {
          name: 'oldPassword',
          label: 'Password admin attuale',
          type: 'password',
          required: true
        },
        {
          name: 'newPassword',
          label: 'Nuova password admin',
          type: 'password',
          required: true,
          minLength: 6,
          minLengthMessage: 'La password admin deve contenere almeno 6 caratteri',
          helperText: 'Minimo 6 caratteri.',
          autoFocus: true
        }
      ]
    });
    if (!values) return;
    await onAdminChangePassword({
      oldPassword: values.oldPassword,
      newPassword: values.newPassword.trim()
    });
  };

  const isLockedByOther = !!(lockInfo?.locked && !isLocked);

  const handleLockClick = () => {
    if (!department) return;

    if (isLocked) {
      handleMenuAction(onReleaseLock);
      return;
    }

    if (isLockedByOther) {
      handleMenuAction(onRefreshLock);
      return;
    }

    handleMenuAction(onEnableLock);
  };

  const lockStatus = isLocked
    ? { icon: '🔒', label: 'In Modifica', className: 'status-lock--active', clickable: true, title: 'Clicca per rilasciare la modifica' }
    : isLockedByOther
      ? { icon: '🔒', label: `Modifica: ${lockInfo?.lockedBy || 'altro utente'}`, className: 'status-lock--other', clickable: false, title: `In modifica da ${lockInfo?.lockedBy || 'altro utente'}` }
      : { icon: '📝', label: 'Abilita Modifica', className: 'status-lock--free', clickable: true, title: 'Clicca per iniziare a modificare' };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <h1 className="topbar__title">OnlyGANTT</h1>
        {(department || adminToken || (departments && departments.length > 0)) && (
          <div className="topbar__context">
            <span className="topbar__context-item">
              <span className="topbar__context-label">Reparto:</span>
              {departments && departments.length > 0 ? (
                <select
                  value={department || ''}
                  onChange={(e) => onDepartmentChange(e.target.value || null)}
                  className="topbar__dept-select"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginLeft: '0.35rem'
                  }}
                >
                  <option value="">-- Seleziona reparto --</option>
                  {departments.map((d) => {
                    const deptName = typeof d === 'string' ? d : d.name;
                    const isProt = typeof d === 'object' && d.protected;
                    return (
                      <option key={deptName} value={deptName}>
                        {deptName} {isProt ? '🔒' : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="topbar__context-value">{department || '—'}</span>
              )}
            </span>
            <span className="topbar__context-sep">|</span>
            <span className="topbar__context-item">
              <span className="topbar__context-label">Utente:</span>
              <span className="topbar__context-value">{adminToken ? 'admin' : (userName || '—')}</span>
            </span>
          </div>
        )}
      </div>

      <div className="topbar__right">
        <div className="topbar__status">
          {department && (
            <button
              className={`topbar__status-item ${lockStatus.className} ${lockStatus.clickable ? 'clickable' : ''}`}
              title={lockStatus.title}
              onClick={lockStatus.clickable ? handleLockClick : undefined}
              disabled={!lockStatus.clickable}
              style={{ border: 'none', background: 'transparent', padding: '0.25rem 0.75rem', cursor: lockStatus.clickable ? 'pointer' : 'default' }}
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
        </div>

        <button
          ref={menuButtonRef}
          className="topbar__menu-btn"
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label="Apri menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="topbar-menu"
        >
          <span className="topbar__menu-icon">☰</span>
        </button>

        {menuOpen && (
          <div id="topbar-menu" ref={menuRef} className="topbar__dropdown" role="menu">
            <div className="topbar__dropdown-section">
              <div className="topbar__dropdown-title">Reparto</div>
              <button
                className="topbar__dropdown-item"
                role="menuitem"
                onClick={() => handleMenuAction(() => onDepartmentChange(null))}
                disabled={!department}
              >
                Cambia reparto
              </button>
              <button
                className="topbar__dropdown-item"
                role="menuitem"
                onClick={() => handleMenuAction(onEnableLock)}
                disabled={!department || lockEnabled || isLockedByOther}
              >
                Modifica reparto
              </button>
              {isLockedByOther && (
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(lockEnabled ? onRefreshLock : onEnableLock)}
                  disabled={!department}
                >
                  Richiedi modifica
                </button>
              )}
              <button
                className="topbar__dropdown-item"
                role="menuitem"
                onClick={() => handleMenuAction(onReleaseLock)}
                disabled={!department || !isLocked}
              >
                Libera reparto
              </button>
              <button
                className="topbar__dropdown-item"
                role="menuitem"
                onClick={() => handleMenuAction(handlePasswordChange)}
                disabled={!department || readOnlyDepartment || adminToken}
              >
                Cambia password
              </button>
            </div>

            {adminToken && (
              <div className="topbar__dropdown-section">
                <div className="topbar__dropdown-title">Admin</div>
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(onNavigateSystemSettings)}
                >
                  Impostazioni di sistema
                </button>
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(onNavigateUserManagement)}
                >
                  Gestione utenti
                </button>
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(handleAdminCreate)}
                >
                  Crea reparto
                </button>
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(handleAdminPasswordReset)}
                  disabled={!department}
                >
                  Imposta password reparto
                </button>
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(handleAdminChangePassword)}
                >
                  Cambia password admin
                </button>
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => handleMenuAction(handleAdminDelete)}
                  disabled={!department}
                >
                  Elimina reparto
                </button>
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => handleMenuAction(onAdminReleaseLock)}
                  disabled={!department || !lockInfo?.locked || isLocked}
                >
                  Sblocca reparto
                </button>
              </div>
            )}

            <div className="topbar__dropdown-section">
              <div className="topbar__dropdown-title">Sessione</div>
              {userToken || adminToken ? (
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => handleMenuAction(onUserLogout)}
                >
                  Logout
                </button>
              ) : (
                <button
                  className="topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => handleMenuAction(() => onDepartmentChange(null))}
                >
                  🔑 Accedi / Login
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.HeaderBar = HeaderBar;
}

export default HeaderBar;
