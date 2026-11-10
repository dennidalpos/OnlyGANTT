import api from '../api.js';

const { useMemo, useState, useEffect, useRef, useCallback } = React;

export function SystemSettings({
  onBack,
  onAdminModularExport,
  onAdminModularImport,
  adminToken,
  dialogApi,
  pushNotification
}) {
  const [modules, setModules] = useState({
    departments: true,
    users: true,
    settings: true
  });
  const [ldapConfig, setLdapConfig] = useState({
    enabled: false,
    log: false,
    url: '',
    bindDn: '',
    bindPassword: '',
    baseDn: '',
    userFilter: '(sAMAccountName={{username}})',
    requiredGroupDn: '',
    groupSearchBase: '',
    localFallback: false
  });
  const [ldapHasSavedBindPassword, setLdapHasSavedBindPassword] = useState(false);
  const [ldapTestUserId, setLdapTestUserId] = useState('');
  const [ldapTestStatus, setLdapTestStatus] = useState(null);
  const [ldapLoading, setLdapLoading] = useState(true);
  const [ldapTesting, setLdapTesting] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState(null);
  const [serverConfig, setServerConfig] = useState({
    lockTimeoutMinutes: 60,
    userSessionTtlHours: 8,
    adminSessionTtlHours: 8,
    maxUploadBytes: 2000000,
    enableBak: true
  });
  const [httpsConfig, setHttpsConfig] = useState({
    enabled: false,
    keyPath: '',
    certPath: ''
  });
  const [systemStatus, setSystemStatus] = useState(null);
  const [restartingServer, setRestartingServer] = useState(false);

  const fetchSystemConfig = useCallback(async (signal) => {
    if (!adminToken) return;
    setLdapLoading(true);
    try {
      const data = await api.getSystemConfig(adminToken, signal);
      if (data.ldap) {
        setLdapConfig({
          enabled: !!data.ldap.enabled,
          log: !!data.ldap.log,
          url: data.ldap.url || '',
          bindDn: data.ldap.bindDn || '',
          bindPassword: '',
          baseDn: data.ldap.baseDn || '',
          userFilter: data.ldap.userFilter || '(sAMAccountName={{username}})',
          requiredGroupDn: data.ldap.requiredGroupDn || '',
          groupSearchBase: data.ldap.groupSearchBase || '',
          localFallback: !!data.ldap.localFallback
        });
        setLdapHasSavedBindPassword(!!data.ldap.bindPasswordSet);
      }
      if (data.server) {
        setServerConfig({
          lockTimeoutMinutes: data.server.lockTimeoutMinutes ?? 60,
          userSessionTtlHours: data.server.userSessionTtlHours ?? 8,
          adminSessionTtlHours: data.server.adminSessionTtlHours ?? 8,
          maxUploadBytes: data.server.maxUploadBytes ?? 2000000,
          enableBak: data.server.enableBak ?? true
        });
      }
      if (data.https) {
        setHttpsConfig({
          enabled: !!data.https.enabled,
          keyPath: data.https.keyPath || '',
          certPath: data.https.certPath || ''
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Impossibile caricare la configurazione di sistema:', err.message);
      }
    } finally {
      setLdapLoading(false);
    }
  }, [adminToken]);

  const fetchSystemStatus = useCallback(async (signal) => {
    if (!adminToken) return;
    try {
      const data = await api.getSystemStatus(adminToken, signal);
      setSystemStatus(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Impossibile caricare lo stato del sistema:', err.message);
      }
    }
  }, [adminToken]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSystemConfig(controller.signal);
    fetchSystemStatus(controller.signal);
    return () => controller.abort();
  }, [fetchSystemConfig, fetchSystemStatus]);

  const handleLdapConfigChange = (field, value) => {
    setLdapConfig((prev) => ({ ...prev, [field]: value }));
    setLdapTestStatus(null);
    setConfigMessage(null);
  };

  const handleServerConfigChange = (field, value) => {
    setServerConfig((prev) => ({ ...prev, [field]: value }));
    setConfigMessage(null);
  };

  const handleHttpsConfigChange = (field, value) => {
    setHttpsConfig((prev) => ({ ...prev, [field]: value }));
    setConfigMessage(null);
  };

  const handleSaveSystemConfig = async () => {
    if (!adminToken || configSaving) return;
    setConfigSaving(true);
    setConfigMessage(null);

    const payload = {
      server: serverConfig,
      ldap: ldapConfig,
      https: httpsConfig
    };

    try {
      const result = await api.updateSystemConfig(payload, adminToken);
      if (result.ok) {
        setConfigMessage({ type: 'success', text: 'Impostazioni salvate con successo.' });
        if (pushNotification) {
          pushNotification({ type: 'success', message: 'Impostazioni salvate con successo' });
        }
        if (result.config?.ldap) {
          setLdapHasSavedBindPassword(!!result.config.ldap.bindPasswordSet);
          setLdapConfig((prev) => ({ ...prev, bindPassword: '' }));
        }
        fetchSystemStatus();
      }
    } catch (err) {
      setConfigMessage({ type: 'error', text: err.message || 'Errore durante il salvataggio.' });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTestLdap = async () => {
    if (!adminToken || ldapTesting) return;
    setLdapTesting(true);
    setLdapTestStatus(null);

    try {
      const result = await api.testLdapConnection(ldapConfig, ldapTestUserId.trim(), adminToken);
      setLdapTestStatus(result);
    } catch (err) {
      setLdapTestStatus({
        ok: false,
        code: err.code || 'TEST_FAILED',
        message: err.message || 'Errore durante il test di connessione.'
      });
    } finally {
      setLdapTesting(false);
    }
  };

  const handleServerRestart = async () => {
    if (!adminToken || restartingServer || !dialogApi) return;

    const confirmed = await dialogApi.confirm({
      title: 'Riavvio Server',
      message: 'Riavviare il processo server Node.js di OnlyGANTT? I client attualmente connessi dovranno riconnettersi.',
      confirmLabel: 'Riavvia Server',
      confirmTone: 'danger'
    });

    if (!confirmed) return;

    setRestartingServer(true);
    try {
      await api.adminServerRestart(adminToken);
      if (pushNotification) {
        pushNotification({ type: 'info', message: 'Richiesta di riavvio inviata' });
      }
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      if (pushNotification) {
        pushNotification({ type: 'error', message: err.message || 'Errore durante il riavvio del server' });
      }
      setRestartingServer(false);
    }
  };

  const handleModuleToggle = (key) => {
    setModules((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const moduleDefinitions = useMemo(() => [
    { key: 'departments', label: 'Reparti & Progetti', icon: '📁' },
    { key: 'users', label: 'Utenti', icon: '👥' },
    { key: 'settings', label: 'Impostazioni', icon: '⚙️' }
  ], []);

  const canUseModules = useMemo(() => Object.values(modules).some(Boolean), [modules]);

  const modulesSummary = useMemo(() => {
    const activeLabels = moduleDefinitions
      .filter((m) => modules[m.key])
      .map((m) => m.label);

    if (activeLabels.length === 0) return 'Nessun modulo selezionato';
    return activeLabels.join(', ');
  }, [moduleDefinitions, modules]);

  const handleModularExport = () => {
    if (!canUseModules) return;
    onAdminModularExport(modules);
  };

  const handleModularImport = async (file) => {
    if (!canUseModules) return;
    onAdminModularImport(file, modules);
  };

  return (
    <main className="main-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Impostazioni di Sistema</h2>
            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              Configurazione globale del server, integrazione Active Directory / LDAP e gestione backup.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Torna al Reparto
          </button>
        </div>

        {configMessage && (
          <div className={`alert-item ${configMessage.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
            {configMessage.text}
          </div>
        )}

        <div className="card-section" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Impostazioni Server</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sys-lockTimeout">Timeout Lock (minuti)</label>
              <input
                id="sys-lockTimeout"
                type="number"
                min="1"
                max="1440"
                value={serverConfig.lockTimeoutMinutes}
                onChange={(e) => handleServerConfigChange('lockTimeoutMinutes', parseInt(e.target.value, 10) || 60)}
              />
              <span className="input-hint">Tempo di inattività prima che il lock di un reparto scada automaticamente.</span>
            </div>

            <div className="form-group">
              <label htmlFor="sys-userSessionTtl">TTL Sessione Utente (ore)</label>
              <input
                id="sys-userSessionTtl"
                type="number"
                min="1"
                max="168"
                value={serverConfig.userSessionTtlHours}
                onChange={(e) => handleServerConfigChange('userSessionTtlHours', parseInt(e.target.value, 10) || 8)}
              />
              <span className="input-hint">Durata massima della sessione utente normale.</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sys-maxUpload">Dimensione Max Upload (byte)</label>
              <input
                id="sys-maxUpload"
                type="number"
                min="100000"
                max="50000000"
                value={serverConfig.maxUploadBytes}
                onChange={(e) => handleServerConfigChange('maxUploadBytes', parseInt(e.target.value, 10) || 2000000)}
              />
              <span className="input-hint">Limite di dimensione per i file JSON caricati ({Math.round(serverConfig.maxUploadBytes / 1000000)} MB).</span>
            </div>

            <div className="form-group">
              <label className="checkbox-label" htmlFor="sys-enableBak" style={{ marginTop: '1.8rem' }}>
                <input
                  id="sys-enableBak"
                  type="checkbox"
                  checked={serverConfig.enableBak}
                  onChange={(e) => handleServerConfigChange('enableBak', e.target.checked)}
                />
                Abilita backup automatici `.bak` per i file JSON
              </label>
            </div>
          </div>
        </div>

        <div className="card-section" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Autenticazione Active Directory / LDAP</h3>
            <label className="checkbox-label" htmlFor="sys-ldapEnabled">
              <input
                id="sys-ldapEnabled"
                type="checkbox"
                checked={ldapConfig.enabled}
                onChange={(e) => handleLdapConfigChange('enabled', e.target.checked)}
              />
              Abilita LDAP
            </label>
          </div>

          {ldapLoading ? (
            <p className="text-muted">Caricamento impostazioni LDAP in corso...</p>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sys-ldapUrl">URL Server LDAP / Domain Controller *</label>
                  <input
                    id="sys-ldapUrl"
                    type="text"
                    value={ldapConfig.url}
                    onChange={(e) => handleLdapConfigChange('url', e.target.value)}
                    placeholder="ldap://dc.azienda.local:389"
                    disabled={!ldapConfig.enabled}
                  />
                  <span className="input-hint">Es: ldap://192.168.1.10:389 o ldaps://dc.azienda.local:636</span>
                </div>

                <div className="form-group">
                  <label htmlFor="sys-ldapBaseDn">Base DN *</label>
                  <input
                    id="sys-ldapBaseDn"
                    type="text"
                    value={ldapConfig.baseDn}
                    onChange={(e) => handleLdapConfigChange('baseDn', e.target.value)}
                    placeholder="DC=azienda,DC=local"
                    disabled={!ldapConfig.enabled}
                  />
                  <span className="input-hint">Punto di partenza per la ricerca degli utenti.</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sys-ldapBindDn">Bind DN (Utente di servizio)</label>
                  <input
                    id="sys-ldapBindDn"
                    type="text"
                    value={ldapConfig.bindDn}
                    onChange={(e) => handleLdapConfigChange('bindDn', e.target.value)}
                    placeholder="CN=ServiceAccount,OU=Users,DC=azienda,DC=local"
                    disabled={!ldapConfig.enabled}
                  />
                  <span className="input-hint">Lascia vuoto per l'autenticazione anonima (se supportata dal server).</span>
                </div>

                <div className="form-group">
                  <label htmlFor="sys-ldapBindPassword">
                    Password Bind {ldapHasSavedBindPassword ? '(Salvata — lascia vuoto per non modificare)' : ''}
                  </label>
                  <input
                    id="sys-ldapBindPassword"
                    type="password"
                    value={ldapConfig.bindPassword}
                    onChange={(e) => handleLdapConfigChange('bindPassword', e.target.value)}
                    placeholder={ldapHasSavedBindPassword ? '••••••••' : 'Password account di servizio'}
                    disabled={!ldapConfig.enabled}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sys-ldapUserFilter">Filtro Ricerca Utente</label>
                  <input
                    id="sys-ldapUserFilter"
                    type="text"
                    value={ldapConfig.userFilter}
                    onChange={(e) => handleLdapConfigChange('userFilter', e.target.value)}
                    placeholder="(sAMAccountName={{username}})"
                    disabled={!ldapConfig.enabled}
                  />
                  <span className="input-hint">Utilizza &#123;&#123;username&#125;&#125; come segnaposto per il nome utente immesso.</span>
                </div>

                <div className="form-group">
                  <label htmlFor="sys-ldapRequiredGroup">DN Gruppo Richiesto (Opzionale)</label>
                  <input
                    id="sys-ldapRequiredGroup"
                    type="text"
                    value={ldapConfig.requiredGroupDn}
                    onChange={(e) => handleLdapConfigChange('requiredGroupDn', e.target.value)}
                    placeholder="CN=OnlyGanttUsers,OU=Groups,DC=azienda,DC=local"
                    disabled={!ldapConfig.enabled}
                  />
                  <span className="input-hint">Se specificato, solo i membri di questo gruppo potranno accedere.</span>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label" htmlFor="sys-ldapLocalFallback">
                  <input
                    id="sys-ldapLocalFallback"
                    type="checkbox"
                    checked={ldapConfig.localFallback}
                    onChange={(e) => handleLdapConfigChange('localFallback', e.target.checked)}
                    disabled={!ldapConfig.enabled}
                  />
                  Consenti il fallback agli utenti locali se l'autenticazione LDAP fallisce o il server non è raggiungibile
                </label>
              </div>

              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Test Connessione LDAP</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={ldapTestUserId}
                    onChange={(e) => setLdapTestUserId(e.target.value)}
                    placeholder="Nome utente per test (opzionale)"
                    disabled={!ldapConfig.enabled || ldapTesting}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleTestLdap}
                    disabled={!ldapConfig.enabled || ldapTesting || !ldapConfig.url}
                  >
                    {ldapTesting ? 'Testing...' : 'Testa Connessione'}
                  </button>
                </div>

                {ldapTestStatus && (
                  <div className={`alert-item ${ldapTestStatus.ok ? 'success' : 'error'}`} style={{ marginTop: '0.75rem' }}>
                    <strong>{ldapTestStatus.ok ? 'Test Riuscito:' : 'Test Fallito:'}</strong> {ldapTestStatus.message}
                    {ldapTestStatus.profile && (
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Profilo trovato: {ldapTestStatus.profile.displayName} ({ldapTestStatus.profile.mail || 'No email'})
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="card-section" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Manutenzione Server & Stato</h3>
          {systemStatus ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Versione Node.js</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{systemStatus.nodeVersion || systemStatus.server?.nodeVersion || '—'}</div>
              </div>
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Uptime Processo</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{Math.round((systemStatus.uptimeSeconds ?? systemStatus.server?.uptimeSeconds ?? 0) / 60)} min</div>
              </div>
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Uso Memoria (RSS)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{Math.round((systemStatus.memoryUsage?.rss || systemStatus.environment?.memoryRss || 0) / 1024 / 1024)} MB</div>
              </div>
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reparti Totali</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{systemStatus.departmentsCount ?? 0}</div>
              </div>
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sessioni Utente Attive</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{systemStatus.activeUserSessions ?? 0}</div>
              </div>
            </div>
          ) : (
            <p className="text-muted" style={{ marginBottom: '1rem' }}>Caricamento metriche server in corso...</p>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              className="btn-success"
              onClick={handleSaveSystemConfig}
              disabled={configSaving}
            >
              {configSaving ? 'Salvataggio...' : 'Salva Tutte le Impostazioni'}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleServerRestart}
              disabled={restartingServer}
            >
              {restartingServer ? 'Riavvio in corso...' : 'Riavvia Server Node'}
            </button>
          </div>
        </div>

        <div className="card-section">
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Export & Import Modulare</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Seleziona i moduli da includere nell'esportazione o da applicare durante l'importazione.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {moduleDefinitions.map((mod) => (
              <label key={mod.key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={modules[mod.key]}
                  onChange={() => handleModuleToggle(mod.key)}
                />
                {mod.icon} {mod.label}
              </label>
            ))}
          </div>
          <div className="alert-item info" style={{ marginTop: '0.75rem' }}>
            Moduli selezionati: {modulesSummary}
          </div>
          <div className="alert-item info" style={{ marginTop: '0.75rem' }}>
            Moduli supportati dal backup modulare: reparti, utenti e impostazioni.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button
              className="btn-success"
              onClick={handleModularExport}
              disabled={!canUseModules}
            >
              Esporta impostazioni
            </button>
            <label className="btn-secondary" style={{ margin: 0, cursor: canUseModules ? 'pointer' : 'default', opacity: canUseModules ? 1 : 0.6 }}>
              Importa impostazioni
              <input
                type="file"
                accept=".json"
                disabled={!canUseModules}
                onChange={(event) => {
                  const file = event.target.files[0];
                  if (file) {
                    handleModularImport(file);
                    event.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.SystemSettings = SystemSettings;
}

export default SystemSettings;
