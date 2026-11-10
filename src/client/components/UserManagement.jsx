import api from '../api.js';

const { useMemo, useState, useEffect, useCallback } = React;

export function UserManagement({ adminToken, onBack, dialogApi }) {
  const emptyForm = {
    userId: '',
    displayName: '',
    mail: '',
    department: '',
    password: ''
  };

  const [activeTab, setActiveTab] = useState('local');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ldapError, setLdapError] = useState(null);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [localUserForm, setLocalUserForm] = useState(emptyForm);

  // Selected user for managing department permissions
  const [permissionUser, setPermissionUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    if (!adminToken) return undefined;
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      setError('');
      setLdapError(null);
      try {
        const [userData, deptData] = await Promise.all([
          api.getAdminUsers(adminToken, controller.signal),
          api.getDepartments(controller.signal)
        ]);

        setUsers(Array.isArray(userData.users) ? userData.users : []);
        setLdapEnabled(!!userData.ldapEnabled);
        setLdapError(userData.ldapError || null);

        const deptList = Array.isArray(deptData?.departments) ? deptData.departments : [];
        setDepartments(deptList.map(d => typeof d === 'string' ? { name: d } : d));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Impossibile caricare i dati utenti e reparti.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => controller.abort();
  }, [adminToken, refreshKey]);

  const handleEdit = (user) => {
    setEditingUserId(user.userId);
    setLocalUserForm({
      userId: user.userId,
      displayName: user.displayName || '',
      mail: user.mail || '',
      department: user.department || '',
      password: ''
    });
  };

  const handleCancel = () => {
    setEditingUserId(null);
    setLocalUserForm(emptyForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!adminToken || saving) return;

    if (!localUserForm.userId.trim()) {
      setError('L\'ID Utente è obbligatorio.');
      return;
    }

    if (!editingUserId && !localUserForm.password) {
      setError('La password è obbligatoria per un nuovo utente locale.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.saveLocalUser(localUserForm, adminToken);
      setEditingUserId(null);
      setLocalUserForm(emptyForm);
      setSuccessMsg('Utente locale salvato con successo.');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Impossibile salvare l\'utente locale.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!adminToken || !dialogApi) return;
    const confirmed = await dialogApi.confirm({
      title: 'Elimina Utente Locale',
      message: `Rimuovere l'utente locale "${user.userId}"?`,
      confirmLabel: 'Elimina Utente',
      confirmTone: 'danger'
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await api.deleteLocalUser(user.userId, adminToken);
      if (editingUserId === user.userId) {
        handleCancel();
      }
      if (permissionUser?.userId === user.userId) {
        setPermissionUser(null);
      }
      setSuccessMsg(`Utente ${user.userId} eliminato.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Impossibile eliminare l\'utente.');
      setLoading(false);
    }
  };

  const openPermissionManager = (user) => {
    setPermissionUser(user);
    const existing = user.departmentPermissions || {};
    setUserPermissions({ ...existing });
  };

  const handlePermissionChange = (deptName, role) => {
    setUserPermissions(prev => ({
      ...prev,
      [deptName]: role
    }));
  };

  const handleSavePermissions = async () => {
    if (!permissionUser || !adminToken) return;

    setSavingPermissions(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.saveUserDepartmentPermissions(permissionUser.userId, userPermissions, adminToken);
      setSuccessMsg(`Permessi reparti salvati per l'utente ${permissionUser.userId}.`);
      setPermissionUser(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err.message || 'Impossibile salvare i permessi reparti.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const localUsers = useMemo(() => users.filter((u) => u.userType === 'local' || u.source === 'local' || u.type === 'local'), [users]);
  const adUsers = useMemo(() => users.filter((u) => u.userType === 'ad' || u.source === 'ad' || u.type === 'ad'), [users]);

  return (
    <main className="main-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Gestione Utenti & Autorizzazioni Reparti</h2>
            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              Gestione distinta degli utenti Locali ed Active Directory. Assegna il ruolo per reparto (Supervisor, Modifica, Sola Lettura, Nessuno).
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Torna al Reparto
          </button>
        </div>

        {error && (
          <div className="alert-item error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div className="alert-item success" style={{ marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}

        {ldapError && (
          <div className="alert-item warning" style={{ marginBottom: '1rem' }}>
            <strong>Avviso Active Directory / LDAP:</strong> {ldapError}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="login-tabs" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`login-tab ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => { setActiveTab('local'); setPermissionUser(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'local' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: activeTab === 'local' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            💻 Utenti Locali ({localUsers.length})
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === 'ad' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ad'); setPermissionUser(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'ad' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: activeTab === 'ad' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            🏢 Utenti Active Directory / AD ({adUsers.length}) {ldapEnabled ? '🟢' : '⚪'}
          </button>
        </div>

        {/* Permission Assignment Panel (Modal/Drawer style) */}
        {permissionUser && (
          <div className="card-section" style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-light)' }}>
                🔑 Permessi Reparti per Utente: <strong>{permissionUser.userId}</strong> ({permissionUser.userType === 'ad' ? 'AD' : 'Locale'})
              </h3>
              <button type="button" className="btn-secondary btn-small" onClick={() => setPermissionUser(null)}>
                ✕ Chiudi
              </button>
            </div>

            {departments.length === 0 ? (
              <p className="text-muted">Nessun reparto disponibile per l'assegnazione.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Nome Reparto</th>
                      <th style={{ textAlign: 'center' }}>👑 Supervisor (Full)</th>
                      <th style={{ textAlign: 'center' }}>✏️ Modifica (Editor)</th>
                      <th style={{ textAlign: 'center' }}>👁️ Sola Lettura (Viewer)</th>
                      <th style={{ textAlign: 'center' }}>🚫 Nessun Accesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => {
                      const deptName = dept.name;
                      const currentRole = userPermissions[deptName] || 'none';
                      return (
                        <tr key={deptName}>
                          <td><strong>{deptName}</strong> {dept.protected ? '🔒' : ''}</td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={`perm_${deptName}`}
                              checked={currentRole === 'supervisor'}
                              onChange={() => handlePermissionChange(deptName, 'supervisor')}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={`perm_${deptName}`}
                              checked={currentRole === 'editor'}
                              onChange={() => handlePermissionChange(deptName, 'editor')}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={`perm_${deptName}`}
                              checked={currentRole === 'viewer'}
                              onChange={() => handlePermissionChange(deptName, 'viewer')}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={`perm_${deptName}`}
                              checked={currentRole === 'none'}
                              onChange={() => handlePermissionChange(deptName, 'none')}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="button-group">
              <button type="button" className="btn-success" onClick={handleSavePermissions} disabled={savingPermissions}>
                {savingPermissions ? 'Salvataggio...' : 'Salva Permessi Reparti'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPermissionUser(null)}>
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: LOCAL USERS */}
        {activeTab === 'local' && (
          <>
            <div className="card-section" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                {editingUserId ? `Modifica Utente Locale: ${editingUserId}` : 'Nuovo Utente Locale'}
              </h3>
              <form onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="um-userId">ID Utente (Username) *</label>
                    <input
                      id="um-userId"
                      type="text"
                      value={localUserForm.userId}
                      onChange={(e) => setLocalUserForm({ ...localUserForm, userId: e.target.value })}
                      disabled={!!editingUserId || saving}
                      placeholder="es. mario.rossi"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="um-displayName">Nome Visualizzato</label>
                    <input
                      id="um-displayName"
                      type="text"
                      value={localUserForm.displayName}
                      onChange={(e) => setLocalUserForm({ ...localUserForm, displayName: e.target.value })}
                      disabled={saving}
                      placeholder="es. Mario Rossi"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="um-mail">Email</label>
                    <input
                      id="um-mail"
                      type="email"
                      value={localUserForm.mail}
                      onChange={(e) => setLocalUserForm({ ...localUserForm, mail: e.target.value })}
                      disabled={saving}
                      placeholder="mario.rossi@azienda.it"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="um-password">
                      {editingUserId ? 'Nuova Password (opzionale)' : 'Password *'}
                    </label>
                    <input
                      id="um-password"
                      type="password"
                      value={localUserForm.password}
                      onChange={(e) => setLocalUserForm({ ...localUserForm, password: e.target.value })}
                      disabled={saving}
                      placeholder={editingUserId ? '••••••••' : 'Inserisci password'}
                    />
                  </div>
                </div>

                <div className="button-group" style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn-success" disabled={saving}>
                    {saving ? 'Salvataggio...' : (editingUserId ? 'Aggiorna Utente' : 'Crea Utente Locale')}
                  </button>
                  {editingUserId && (
                    <button type="button" className="btn-secondary" onClick={handleCancel} disabled={saving}>
                      Annulla Modifica
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="card-section">
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Elenco Utenti Locali ({localUsers.length})</h3>
              {loading ? (
                <p className="text-muted">Caricamento utenti in corso...</p>
              ) : localUsers.length === 0 ? (
                <p className="text-muted">Nessun utente locale registrato nel sistema.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Nome Visualizzato</th>
                        <th>Email</th>
                        <th>Permessi Reparti</th>
                        <th>Ultimo Accesso</th>
                        <th style={{ textAlign: 'right' }}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localUsers.map((u) => {
                        const permCount = Object.keys(u.departmentPermissions || {}).length;
                        return (
                          <tr key={u.userId}>
                            <td><strong>{u.userId}</strong></td>
                            <td>{u.displayName || '—'}</td>
                            <td>{u.mail || '—'}</td>
                            <td>
                              <span className="badge badge--in_corso">
                                {permCount > 0 ? `${permCount} reparti` : 'Nessuno'}
                              </span>
                            </td>
                            <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('it-IT') : 'Mai'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-success btn-small"
                                onClick={() => openPermissionManager(u)}
                                style={{ marginRight: '0.5rem' }}
                              >
                                🔑 Permessi Reparti
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => handleEdit(u)}
                                style={{ marginRight: '0.5rem' }}
                              >
                                Modifica
                              </button>
                              <button
                                type="button"
                                className="btn-danger btn-small"
                                onClick={() => handleDelete(u)}
                              >
                                Elimina
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab 2: AD USERS */}
        {activeTab === 'ad' && (
          <div className="card-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Utenti Active Directory / AD ({adUsers.length})
              </h3>
              <span className={`badge ${ldapEnabled ? 'badge--in_corso' : 'badge--da_iniziare'}`}>
                {ldapEnabled ? 'LDAP/AD Attivo' : 'LDAP/AD Disattivato'}
              </span>
            </div>

            {!ldapEnabled ? (
              <p className="text-muted">
                L'integrazione Active Directory / LDAP è attualmente disattivata nelle impostazioni di sistema. Abilitala nelle Impostazioni di Sistema per sincronizzare gli utenti AD.
              </p>
            ) : adUsers.length === 0 ? (
              <p className="text-muted">
                Nessun utente Active Directory ha ancora effettuato l'accesso o è stato letto da AD.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>sAMAccountName</th>
                      <th>Nome Visualizzato</th>
                      <th>Email</th>
                      <th>Permessi Reparti</th>
                      <th>Ultimo Accesso</th>
                      <th style={{ textAlign: 'right' }}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adUsers.map((u) => {
                      const permCount = Object.keys(u.departmentPermissions || {}).length;
                      return (
                        <tr key={u.userId}>
                          <td><strong>{u.userId}</strong></td>
                          <td>{u.displayName || '—'}</td>
                          <td>{u.mail || '—'}</td>
                          <td>
                            <span className="badge badge--in_corso">
                              {permCount > 0 ? `${permCount} reparti` : 'Nessuno'}
                            </span>
                          </td>
                          <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('it-IT') : 'Mai'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-success btn-small"
                              onClick={() => openPermissionManager(u)}
                            >
                              🔑 Permessi Reparti
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.UserManagement = UserManagement;
}

export default UserManagement;
