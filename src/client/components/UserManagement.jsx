(function() {
  'use strict';

  const { useMemo, useState, useEffect } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function UserManagement({ adminToken, onBack }) {
    const api = window.OnlyGantt.api;
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ldapError, setLdapError] = useState(null);
    const [ldapEnabled, setLdapEnabled] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

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
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '0.75rem' }} className="text-muted">
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
