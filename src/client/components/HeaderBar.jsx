// HeaderBar component
// Exposed on window.OnlyGantt.components.HeaderBar

(function() {
  'use strict';

  const { useState, useEffect, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function HeaderBar({
    userName,
    department,
    onDepartmentChange,
    lockEnabled,
    onEnableLock,
    onUserLogout,
    onExportDepartment,
    onImportDepartment,
    canImportExport,
    readOnlyDepartment,
    adminToken,
    onChangePassword
  }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [menuOpen, setMenuOpen] = useState(false);
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
            {adminToken && <span className="badge badge-success header-admin-badge">Admin attivo</span>}
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
                  <div className="header-menu-title">Gestione reparto</div>
                  <button
                    className="header-menu-item"
                    onClick={() => handleMenuAction(() => onDepartmentChange(null))}
                    disabled={!department}
                  >
                    Cambia reparto
                  </button>
                  <button
                    className="header-menu-item"
                    onClick={() => handleMenuAction(onEnableLock)}
                    disabled={!department || lockEnabled}
                  >
                    Modifica reparto
                  </button>
                  <button
                    className="header-menu-item"
                    onClick={() => handleMenuAction(handlePasswordChange)}
                    disabled={!department || readOnlyDepartment}
                  >
                    Cambia password
                  </button>
                </div>

                <div className="header-menu-section">
                  <div className="header-menu-title">Dati</div>
                  <button
                    className="header-menu-item"
                    onClick={() => handleMenuAction(onExportDepartment)}
                    disabled={!canImportExport}
                  >
                    Export reparto
                  </button>
                  <label className={`header-menu-item ${!canImportExport ? 'disabled' : ''}`} style={{ cursor: canImportExport ? 'pointer' : 'not-allowed' }}>
                    Import reparto
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

                <div className="header-menu-section">
                  <div className="header-menu-title">Sessione</div>
                  <button
                    className="header-menu-item"
                    onClick={() => handleMenuAction(onUserLogout)}
                  >
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
