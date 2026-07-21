import api from '../api.js';

const { useMemo, useState, useEffect } = React;

export function UserManagement({ adminToken, onBack, dialogApi }) {
  const emptyForm = {
    userId: '',
    displayName: '',
    mail: '',
    department: '',
    password: ''
  };
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ldapError, setLdapError] = useState(null);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [localUserForm, setLocalUserForm] = useState(emptyForm);

  useEffect(() => {
    if (!adminToken) return undefined;
    const controller = new AbortController();

    const loadUsers = async () => {
      setLoading(true);
      setError('');
      setLdapError(null);
      try {
        const data = await api.getAdminUsers(adminToken, controller.signal);
        setUsers(Array.isArray(data.users) ? data.users : []);
        setLdapEnabled(!!data.ldapEnabled);
        setLdapError(data.ldapError || null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Impossibile caricare l\'elenco utenti.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
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

    try {
      await api.saveLocalUser(localUserForm, adminToken);
      setEditingUserId(null);
      setLocalUserForm(emptyForm);
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
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Impossibile eliminare l\'utente.');
      setLoading(false);
    }
  };

  const localUsers = useMemo(() => users.filter((u) => u.userType === 'local' || u.source === 'local' || u.type === 'local'), [users]);
  const adUsers = useMemo(() => users.filter((u) => u.userType === 'ad' || u.source === 'ad' || u.type === 'ad'), [users]);

  return (
    <main className="main-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Gestione Utenti</h2>
            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              Gestisci gli utenti locali ed ispeziona le identità synchronize da Active Directory / LDAP.
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

        {ldapError && (
          <div className="alert-item warning" style={{ marginBottom: '1rem' }}>
            <strong>Avviso LDAP:</strong> {ldapError}
          </div>
        )}

        <div className="card-section" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
            {editingUserId ? `Modifica Utente: ${editingUserId}` : 'Nuovo Utente Locale'}
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
                <label htmlFor="um-department">Reparto Predefinito</label>
                <input
                  id="um-department"
                  type="text"
                  value={localUserForm.department}
                  onChange={(e) => setLocalUserForm({ ...localUserForm, department: e.target.value })}
                  disabled={saving}
                  placeholder="es. Progettazione"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="um-password">
                {editingUserId ? 'Nuova Password (lascia vuoto per non modificare)' : 'Password *'}
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

        <div className="card-section" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Utenti Locali ({localUsers.length})</h3>
          {loading ? (
            <p className="text-muted">Caricamento utenti in corso...</p>
          ) : localUsers.length === 0 ? (
            <p className="text-muted">Nessun utente locale registrato.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Nome Visualizzato</th>
                    <th>Email</th>
                    <th>Reparto</th>
                    <th>Ultimo Accesso</th>
                    <th style={{ textAlign: 'right' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {localUsers.map((u) => (
                    <tr key={u.userId}>
                      <td><strong>{u.userId}</strong></td>
                      <td>{u.displayName || '—'}</td>
                      <td>{u.mail || '—'}</td>
                      <td>{u.department || '—'}</td>
                      <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('it-IT') : 'Mai'}</td>
                      <td style={{ textAlign: 'right' }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>
              Utenti Active Directory / LDAP ({adUsers.length})
            </h3>
            <span className={`badge ${ldapEnabled ? 'badge--in_corso' : 'badge--da_iniziare'}`}>
              {ldapEnabled ? 'LDAP Attivo' : 'LDAP Disattivato'}
            </span>
          </div>

          {!ldapEnabled ? (
            <p className="text-muted">
              L'integrazione LDAP è attualmente disattivata nelle impostazioni di sistema.
            </p>
          ) : adUsers.length === 0 ? (
            <p className="text-muted">
              Nessun utente LDAP ha ancora effettuato l'accesso al sistema.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>sAMAccountName</th>
                    <th>Nome Visualizzato</th>
                    <th>Email</th>
                    <th>Reparto (AD)</th>
                    <th>Primo Accesso</th>
                    <th>Ultimo Accesso</th>
                  </tr>
                </thead>
                <tbody>
                  {adUsers.map((u) => (
                    <tr key={u.userId}>
                      <td><strong>{u.userId}</strong></td>
                      <td>{u.displayName || '—'}</td>
                      <td>{u.mail || '—'}</td>
                      <td>{u.department || '—'}</td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('it-IT') : '—'}</td>
                      <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('it-IT') : 'Mai'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
