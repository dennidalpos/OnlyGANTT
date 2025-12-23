// DepartmentSelector component
// Exposed on window.OnlyGantt.components.DepartmentSelector

(function() {
  'use strict';

  const { useState, useEffect, useCallback } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const api = window.OnlyGantt.api;
  const storage = window.OnlyGantt.storage;

  function DepartmentSelector({
    userName,
    department,
    onDepartmentChange,
    adminToken,
    lockInfo,
    onAdminReleaseLock,
    compact = false
  }) {
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [password, setPassword] = useState('');
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [adminNewDept, setAdminNewDept] = useState('');
    const [adminResetPassword, setAdminResetPassword] = useState('');
    const [adminActionError, setAdminActionError] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);

    const loadDepartments = useCallback(async (signal) => {
      try {
        const data = await api.getDepartments(signal);
        setDepartments(data.departments || []);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError('Failed to load departments');
      }
    }, []);

    // Load departments
    useEffect(() => {
      const controller = new AbortController();
      loadDepartments(controller.signal);
      return () => controller.abort();
    }, [loadDepartments]);

    // Sync selected department with active one
    useEffect(() => {
      if (department) {
        setSelectedDept(department);
      }
    }, [department]);

    // Load saved password when department or user changes
    useEffect(() => {
      if (selectedDept && userName) {
        const saved = storage.getPassword(userName, selectedDept);
        setPassword(saved);
      }
    }, [selectedDept, userName]);

    const isUserNameValid = adminToken || (userName && userName.trim().length >= 2);
    const selectedDeptObj = departments.find(d => d.name === selectedDept);
    const activeDeptObj = departments.find(d => d.name === department);
    const hasDepartments = departments.length > 0;
    const canOpenDepartment = Boolean(selectedDeptObj) && isUserNameValid && !adminActionLoading;

    const handleSelectDepartment = async () => {
      if (!selectedDept) {
        setError('Seleziona un reparto');
        return;
      }

      if (!isUserNameValid) {
        setError('Inserisci un nome utente valido');
        return;
      }

      setError('');

      const dept = selectedDeptObj;
      if (!dept) {
        setError('Il reparto selezionato non è disponibile');
        return;
      }

      if (adminToken) {
        onDepartmentChange(selectedDept);
        return;
      }

      // Verify password if protected
      if (dept.protected) {
        try {
          const result = await api.verifyPassword(selectedDept, password);
          if (result.ok) {
            // Save password
            storage.setPassword(userName, selectedDept, password);
            onDepartmentChange(selectedDept);
          } else {
            setError('Password errata');
          }
        } catch (err) {
          setError(err.message || 'Verifica password fallita');
        }
      } else {
        // No password needed
        onDepartmentChange(selectedDept);
      }
    };

    const handleAdminCreateDepartment = async () => {
      if (!adminNewDept) {
        setAdminActionError('Inserisci un nome reparto');
        return;
      }

      setAdminActionLoading(true);
      setAdminActionError('');

      try {
        await api.createDepartment(adminNewDept, adminToken);
        setAdminNewDept('');
        await loadDepartments();
      } catch (err) {
        setAdminActionError(err.message || 'Creazione reparto fallita');
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminDeleteDepartment = async () => {
      if (!selectedDept) {
        setAdminActionError('Seleziona un reparto');
        return;
      }
      if (!confirm(`Eliminare il reparto ${selectedDept}?`)) {
        return;
      }

      setAdminActionLoading(true);
      setAdminActionError('');

      try {
        await api.deleteDepartment(selectedDept, adminToken);
        setSelectedDept('');
        onDepartmentChange(null);
        await loadDepartments();
      } catch (err) {
        setAdminActionError(err.message || 'Eliminazione reparto fallita');
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminResetPassword = async () => {
      if (!selectedDept) {
        setAdminActionError('Seleziona un reparto');
        return;
      }
      if (!adminResetPassword && !confirm('Vuoi rimuovere la password del reparto?')) {
        return;
      }

      setAdminActionLoading(true);
      setAdminActionError('');

      try {
        await api.resetPassword(selectedDept, adminResetPassword || null, adminToken);
        setAdminResetPassword('');
        await loadDepartments();
      } catch (err) {
        setAdminActionError(err.message || 'Reset password fallito');
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminReleaseLock = async () => {
      if (!selectedDept) {
        setAdminActionError('Seleziona un reparto');
        return;
      }

      setAdminActionLoading(true);
      setAdminActionError('');

      try {
        await api.adminReleaseLock(selectedDept, adminToken);
        await loadDepartments();
      } catch (err) {
        setAdminActionError(err.message || 'Sblocco lock fallito');
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handlePasswordChange = async ({ removePassword = false } = {}) => {
      if (activeDeptObj?.protected && !oldPassword) {
        setError('Inserisci la vecchia password');
        return;
      }
      if (!removePassword && !newPassword.trim()) {
        setError('Inserisci una nuova password');
        return;
      }
      if (removePassword && !confirm('Vuoi rimuovere la password del reparto?')) {
        return;
      }

      try {
        const nextPassword = removePassword ? '' : newPassword;
        await api.changePassword(department, oldPassword, nextPassword);
        storage.removePassword(userName, department);
        await loadDepartments();
        setPassword('');
        setShowPasswordChange(false);
        setOldPassword('');
        setNewPassword('');
        setError('');
        onDepartmentChange(null);
        alert('Password aggiornata. Effettua nuovamente l’accesso al reparto.');
      } catch (err) {
        setError(err.message || 'Cambio password fallito');
      }
    };

    const lockStatusLabel = lockInfo?.locked ? 'Bloccato' : 'Sbloccato';
    const lockStatusBadge = lockInfo?.locked ? 'badge-warning' : 'badge-success';

    return (
      <div className={compact ? 'department-selector-inline' : 'card'}>
        {!compact && <h2 className="card-title">Selezione Reparto</h2>}

        {error && (
          <div className="alert-item" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {!department ? (
          <div className={compact ? 'department-selector-row' : undefined}>
            <div className="form-group">
              <label>Reparto</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={!hasDepartments}
              >
                <option value="">-- Seleziona --</option>
                {departments.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name} {d.readOnly ? '(Read-Only)' : ''}
                  </option>
                ))}
              </select>
              {!hasDepartments && (
                <div className="text-muted text-small" style={{ marginTop: '0.25rem' }}>
                  Nessun reparto disponibile. Contatta un admin per crearne uno.
                </div>
              )}
            </div>

            {selectedDeptObj && selectedDeptObj.protected && !adminToken && (
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectDepartment()}
                />
              </div>
            )}

            <button
              onClick={handleSelectDepartment}
              className="btn-success"
              disabled={!canOpenDepartment || !hasDepartments}
            >
              Apri Reparto
            </button>

            {adminToken && (
              <div className="admin-tools">
                <div className="admin-tools-panel compact">
                  {adminActionError && (
                    <div className="alert-item">{adminActionError}</div>
                  )}

                  <div className="admin-tools-row">
                    <div className="form-group">
                      <label>Nuovo reparto</label>
                      <input
                        type="text"
                        value={adminNewDept}
                        onChange={(e) => setAdminNewDept(e.target.value)}
                        placeholder="Nome reparto"
                      />
                    </div>
                    <button
                      onClick={handleAdminCreateDepartment}
                      className="btn-success btn-small"
                      disabled={adminActionLoading}
                    >
                      Crea reparto
                    </button>
                  </div>

                  <div className="admin-tools-row">
                    <div className="form-group">
                      <label>Reset password reparto</label>
                      <input
                        type="text"
                        value={adminResetPassword}
                        onChange={(e) => setAdminResetPassword(e.target.value)}
                        placeholder="Vuoto per rimuovere"
                      />
                    </div>
                    <button
                      onClick={handleAdminResetPassword}
                      className="btn-secondary btn-small"
                      disabled={adminActionLoading}
                    >
                      Reset password
                    </button>
                  </div>

                  {department && (
                    <div className="admin-tools-row admin-tools-row-inline">
                      <div className="admin-lock-status">
                        <span className="text-muted">Stato reparto</span>
                        <span className={`badge ${lockStatusBadge}`}>{lockStatusLabel}</span>
                      </div>
                      {lockInfo?.locked && (
                        <button
                          onClick={onAdminReleaseLock || handleAdminReleaseLock}
                          className="btn-danger btn-small"
                          disabled={adminActionLoading}
                        >
                          Sblocca reparto
                        </button>
                      )}
                    </div>
                  )}

                  <div className="admin-tools-row">
                    <button
                      onClick={handleAdminDeleteDepartment}
                      className="btn-secondary btn-small"
                      disabled={adminActionLoading}
                    >
                      Elimina reparto
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className={compact ? 'department-selector-row' : undefined}>
            <p className={compact ? 'department-selector-current highlight' : undefined}>
              <strong>Reparto corrente:</strong> {department}
              {departments.find(d => d.name === department)?.readOnly && (
                <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Read-Only</span>
              )}
            </p>

            <div className="button-group">
              <button
                onClick={() => onDepartmentChange(null)}
                className="btn-secondary"
              >
                Cambia Reparto
              </button>

              <button
                onClick={() => setShowPasswordChange(true)}
                className="btn-secondary"
              >
                Cambia Password
              </button>
            </div>

            {adminToken && (
              <div className="admin-tools" style={{ marginTop: '0.5rem' }}>
                <div className="admin-tools-panel compact">
                  {adminActionError && (
                    <div className="alert-item">{adminActionError}</div>
                  )}

                  <div className="admin-tools-row">
                    <div className="form-group">
                      <label>Nuovo reparto</label>
                      <input
                        type="text"
                        value={adminNewDept}
                        onChange={(e) => setAdminNewDept(e.target.value)}
                        placeholder="Nome reparto"
                      />
                    </div>
                    <button
                      onClick={handleAdminCreateDepartment}
                      className="btn-success btn-small"
                      disabled={adminActionLoading}
                    >
                      Crea reparto
                    </button>
                  </div>

                  <div className="admin-tools-row">
                    <div className="form-group">
                      <label>Reset password reparto</label>
                      <input
                        type="text"
                        value={adminResetPassword}
                        onChange={(e) => setAdminResetPassword(e.target.value)}
                        placeholder="Vuoto per rimuovere"
                      />
                    </div>
                    <button
                      onClick={handleAdminResetPassword}
                      className="btn-secondary btn-small"
                      disabled={adminActionLoading}
                    >
                      Reset password
                    </button>
                  </div>

                  {department && (
                    <div className="admin-tools-row admin-tools-row-inline">
                      <div className="admin-lock-status">
                        <span className="text-muted">Stato reparto</span>
                        <span className={`badge ${lockStatusBadge}`}>{lockStatusLabel}</span>
                      </div>
                      {lockInfo?.locked && (
                        <button
                          onClick={onAdminReleaseLock || handleAdminReleaseLock}
                          className="btn-danger btn-small"
                          disabled={adminActionLoading}
                        >
                          Sblocca reparto
                        </button>
                      )}
                    </div>
                  )}

                  <div className="admin-tools-row">
                    <button
                      onClick={handleAdminDeleteDepartment}
                      className="btn-secondary btn-small"
                      disabled={adminActionLoading}
                    >
                      Elimina reparto
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPasswordChange && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Cambia Password</h3>
                {activeDeptObj?.protected && (
                  <div className="form-group">
                    <label>Vecchia Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Nuova Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="button-group">
                  <button onClick={() => handlePasswordChange()} className="btn-success">
                    Cambia
                  </button>
                  {activeDeptObj?.protected && (
                    <button onClick={() => handlePasswordChange({ removePassword: true })} className="btn-secondary">
                      Rimuovi password
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowPasswordChange(false);
                      setOldPassword('');
                      setNewPassword('');
                      setError('');
                    }}
                    className="btn-secondary"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  window.OnlyGantt.components.DepartmentSelector = DepartmentSelector;
})();
