(function() {
  'use strict';

  const { useMemo, useState, useEffect } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function UserManagement({ adminToken, onBack, dialogApi }) {
    const api = window.OnlyGantt.api;
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
          if (err.name === 'AbortError') return;
          setError(err.message || 'Errore nel caricamento utenti');
        } finally {
          setLoading(false);
        }
      };

      loadUsers();
      return () => controller.abort();
    }, [adminToken, api, refreshKey]);

    const counts = useMemo(() => {
      const summary = { total: users.length, local: 0, ad: 0 };
      users.forEach((user) => {
        if (user.userType === 'ad') {
          summary.ad += 1;
        } else {
          summary.local += 1;
        }
      });
      return summary;
    }, [users]);

    const renderCell = (value) => (value ? value : '—');
    const renderLastLogin = (value) => {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      if (date.getTime() > Date.now()) return '—';
      return date.toLocaleString('it-IT');
    };

    const renderLdapDiagnostics = (ldapIssue) => {
      if (!ldapIssue) return null;
      const code = ldapIssue.code ? String(ldapIssue.code) : '—';
      const message = ldapIssue.message || 'Errore LDAP';
      const hints = [];
      if (code === 'LDAP_CONFIG_ERROR') {
        hints.push('Verifica LDAP_URL, LDAP_BASE_DN e il filtro utenti.');
      } else if (code === 'LDAP_DOWN') {
        hints.push('Verifica raggiungibilità server LDAP e credenziali Bind DN.');
      } else {
        hints.push('Controlla i log del server LDAP o del servizio OnlyGANTT per dettagli aggiuntivi.');
      }

      return (
        <div className="alert-item warning">
          <div>Impossibile leggere utenti LDAP.</div>
          <div className="text-muted" style={{ marginTop: '0.25rem' }}>
            Codice: <strong>{code}</strong> · Messaggio: <strong>{message}</strong>
          </div>
          {hints.length > 0 && (
            <ul className="text-muted" style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      );
    };

    const resetLocalUserForm = () => {
      setEditingUserId(null);
      setLocalUserForm(emptyForm);
    };

    const handleLocalFieldChange = (field, value) => {
      setLocalUserForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleEditLocalUser = (user) => {
      setError('');
      setEditingUserId(user.userId);
      setLocalUserForm({
        userId: user.userId || '',
        displayName: user.displayName || '',
        mail: user.mail || '',
        department: user.department || '',
        password: ''
      });
    };

    const handleSaveLocalUser = async () => {
      if (!adminToken) return;

      if (!localUserForm.userId.trim()) {
        setError('Username locale obbligatorio');
        return;
      }

      if (!editingUserId && localUserForm.password.length < 6) {
        setError('Password minima di 6 caratteri per i nuovi utenti locali');
        return;
      }

      setSaving(true);
      setError('');

      try {
        await api.saveLocalUser({
          userId: localUserForm.userId.trim(),
          displayName: localUserForm.displayName.trim(),
          mail: localUserForm.mail.trim(),
          department: localUserForm.department.trim(),
          password: localUserForm.password ? localUserForm.password : undefined
        }, adminToken);
        resetLocalUserForm();
        setRefreshKey((prev) => prev + 1);
      } catch (err) {
        setError(err.message || 'Errore nel salvataggio utente locale');
      } finally {
        setSaving(false);
      }
    };

    const handleDeleteLocalUser = async (user) => {
      if (!adminToken || !user?.userId) return;
      if (!dialogApi) return;
      const confirmDelete = await dialogApi.confirm({
        title: 'Elimina utente locale',
        message: `Eliminare l'utente locale "${user.userId}"?`,
        confirmLabel: 'Elimina utente',
        cancelLabel: 'Mantieni utente',
        confirmTone: 'danger'
      });
      if (!confirmDelete) return;

      setSaving(true);
      setError('');
      try {
        await api.deleteLocalUser(user.userId, adminToken);
        if (editingUserId === user.userId) {
          resetLocalUserForm();
        }
        setRefreshKey((prev) => prev + 1);
      } catch (err) {
        setError(err.message || 'Errore nell\'eliminazione utente locale');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 className="card-title">Gestione utenti</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => setRefreshKey((prev) => prev + 1)}>
              Aggiorna elenco
            </button>
            <button className="btn-secondary" onClick={onBack}>
              Torna alla timeline
            </button>
          </div>
        </div>

        <div className="card-section">
          <p className="text-muted">
            Utenti totali: <strong>{counts.total}</strong> · Locali: <strong>{counts.local}</strong> · AD: <strong>{counts.ad}</strong>
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button className="btn-success" onClick={resetLocalUserForm} disabled={saving}>
              Nuovo utente locale
            </button>
            {editingUserId && (
              <button className="btn-secondary" onClick={resetLocalUserForm} disabled={saving}>
                Annulla modifica
              </button>
            )}
          </div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 className="card-title">{editingUserId ? `Modifica utente locale: ${editingUserId}` : 'Crea utente locale'}</h3>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="local-user-id">Username</label>
                <input
                  id="local-user-id"
                  type="text"
                  value={localUserForm.userId}
                  onChange={(e) => handleLocalFieldChange('userId', e.target.value)}
                  disabled={saving || !!editingUserId}
                  autoComplete="username"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="local-display-name">Nome visualizzato</label>
                <input
                  id="local-display-name"
                  type="text"
                  value={localUserForm.displayName}
                  onChange={(e) => handleLocalFieldChange('displayName', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="local-mail">Email</label>
                <input
                  id="local-mail"
                  type="email"
                  value={localUserForm.mail}
                  onChange={(e) => handleLocalFieldChange('mail', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="local-department">Reparto</label>
                <input
                  id="local-department"
                  type="text"
                  value={localUserForm.department}
                  onChange={(e) => handleLocalFieldChange('department', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="local-password">{editingUserId ? 'Nuova password' : 'Password'}</label>
                <input
                  id="local-password"
                  type="password"
                  value={localUserForm.password}
                  onChange={(e) => handleLocalFieldChange('password', e.target.value)}
                  disabled={saving}
                  autoComplete={editingUserId ? 'new-password' : 'current-password'}
                />
                <span className="input-hint">
                  {editingUserId ? 'Lascia vuoto per mantenere la password corrente.' : 'Minimo 6 caratteri.'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn-success" onClick={handleSaveLocalUser} disabled={saving}>
                {saving ? 'Salvataggio...' : editingUserId ? 'Aggiorna utente locale' : 'Crea utente locale'}
              </button>
            </div>
          </div>
          {!ldapEnabled && (
            <div className="alert-item info">LDAP non abilitato: sono mostrati solo utenti locali.</div>
          )}
          {renderLdapDiagnostics(ldapError)}
          {error && <div className="alert-item">Errore: {error}</div>}
        </div>

        <div className="card-section">
          {loading ? (
            <div className="text-center">
              <div className="loading"></div> Caricamento...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Username</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Nome visualizzato</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Reparto</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Ultimo accesso</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '0.75rem' }} className="text-muted">
                        Nessun utente trovato.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={`${user.userType}-${user.userId}`}>
                        <td style={{ padding: '0.5rem' }}>{renderCell(user.userId)}</td>
                        <td style={{ padding: '0.5rem' }}>{renderCell(user.displayName)}</td>
                        <td style={{ padding: '0.5rem' }}>{renderCell(user.mail)}</td>
                        <td style={{ padding: '0.5rem' }}>{renderCell(user.department)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {user.userType === 'ad' ? 'AD' : 'Locale'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{renderLastLogin(user.lastLoginAt)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {user.userType === 'local' ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button className="btn-secondary" onClick={() => handleEditLocalUser(user)} disabled={saving}>
                                Modifica
                              </button>
                              <button className="btn-danger" onClick={() => handleDeleteLocalUser(user)} disabled={saving}>
                                Elimina
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.OnlyGantt.components.UserManagement = UserManagement;
})();
