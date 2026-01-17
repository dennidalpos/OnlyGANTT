(function() {
  'use strict';

  const { useMemo, useState, useEffect, useRef, useCallback } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function SystemSettings({
    onBack,
    onAdminModularExport,
    onAdminModularImport,
    adminToken
  }) {
    const api = window.OnlyGantt.api;
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
    const [configStatus, setConfigStatus] = useState(null);
    const [restartStatus, setRestartStatus] = useState(null);
    const [restartCountdown, setRestartCountdown] = useState(null);
    const [systemStatus, setSystemStatus] = useState(null);
    const [systemStatusLoading, setSystemStatusLoading] = useState(false);
    const [systemStatusError, setSystemStatusError] = useState(null);
    const [httpsConfig, setHttpsConfig] = useState({
      enabled: false,
      keyPath: '',
      certPath: ''
    });
    const restartTimeoutRef = useRef(null);
    const restartIntervalRef = useRef(null);
    const RESTART_DELAY_SECONDS = 5;

    const moduleLabels = {
      departments: 'Reparti',
      users: 'Utenti',
      settings: 'Impostazioni'
    };

    const selectedModules = useMemo(
      () => Object.keys(modules).filter((key) => modules[key]),
      [modules]
    );

    const modulesSummary = selectedModules.length
      ? selectedModules.map((key) => moduleLabels[key] || key).join(', ')
      : 'Nessun modulo selezionato';

    const canUseModules = selectedModules.length > 0;

    const handleModuleToggle = (key) => {
      setModules((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
      if (!adminToken) return undefined;
      const controller = new AbortController();
      const loadSystemConfig = async () => {
        setLdapLoading(true);
        setConfigStatus(null);
        try {
          const data = await api.getSystemConfig(adminToken, controller.signal);
          setLdapConfig({
            enabled: !!data.ldap?.enabled,
            log: !!data.ldap?.log,
            url: data.ldap?.url || '',
            bindDn: data.ldap?.bindDn || '',
            bindPassword: '',
            baseDn: data.ldap?.baseDn || '',
            userFilter: data.ldap?.userFilter || '(sAMAccountName={{username}})',
            requiredGroupDn: data.ldap?.requiredGroupDn || '',
            groupSearchBase: data.ldap?.groupSearchBase || '',
            localFallback: !!data.ldap?.localFallback
          });
          setHttpsConfig({
            enabled: !!data.https?.enabled,
            keyPath: data.https?.keyPath || '',
            certPath: data.https?.certPath || ''
          });
          setLdapHasSavedBindPassword(!!data.ldap?.bindPasswordSet);
        } catch (err) {
          if (err.name === 'AbortError') return;
          setConfigStatus({ type: 'error', message: 'Errore nel caricamento delle configurazioni' });
        } finally {
          setLdapLoading(false);
        }
      };
      loadSystemConfig();
      return () => controller.abort();
    }, [adminToken, api]);

    const loadSystemStatus = useCallback(async (signal) => {
      if (!adminToken) return;
      setSystemStatusLoading(true);
      setSystemStatusError(null);
      try {
        const data = await api.getSystemStatus(adminToken, signal);
        setSystemStatus(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setSystemStatusError('Errore nel caricamento dello stato server.');
      } finally {
        setSystemStatusLoading(false);
      }
    }, [adminToken, api]);

    useEffect(() => {
      if (!adminToken) {
        setSystemStatus(null);
        return undefined;
      }
      const controller = new AbortController();
      loadSystemStatus(controller.signal);
      return () => controller.abort();
    }, [adminToken, loadSystemStatus]);

    useEffect(() => {
      return () => {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        if (restartIntervalRef.current) {
          clearInterval(restartIntervalRef.current);
        }
      };
    }, []);

    const handleLdapFieldChange = (field, value) => {
      setLdapConfig((prev) => ({ ...prev, [field]: value }));
    };

    const handleHttpsFieldChange = (field, value) => {
      setHttpsConfig((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveSystemConfig = async () => {
      if (!adminToken) return;
      setConfigSaving(true);
      setConfigStatus(null);
      try {
        const payload = {
          ldap: {
            enabled: ldapConfig.enabled,
            log: ldapConfig.log,
            url: ldapConfig.url,
            bindDn: ldapConfig.bindDn,
            bindPassword: ldapConfig.bindPassword ? ldapConfig.bindPassword : null,
            baseDn: ldapConfig.baseDn,
            userFilter: ldapConfig.userFilter,
            requiredGroupDn: ldapConfig.requiredGroupDn,
            groupSearchBase: ldapConfig.groupSearchBase,
            localFallback: ldapConfig.localFallback
          },
          https: {
            enabled: httpsConfig.enabled,
            keyPath: httpsConfig.keyPath,
            certPath: httpsConfig.certPath
          }
        };
        const result = await api.updateSystemConfig(payload, adminToken);
        setLdapHasSavedBindPassword(!!result.ldap?.bindPasswordSet);
        setLdapConfig((prev) => ({ ...prev, bindPassword: '' }));
        setConfigStatus({ type: 'success', message: 'Configurazioni salvate in modo persistente' });
      } catch (err) {
        setConfigStatus({ type: 'error', message: err.message || 'Salvataggio configurazioni fallito' });
      } finally {
        setConfigSaving(false);
      }
    };

    const clearRestartTimers = () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (restartIntervalRef.current) {
        clearInterval(restartIntervalRef.current);
        restartIntervalRef.current = null;
      }
    };

    const handleServerRestart = async () => {
      if (!adminToken) return;
      const confirmed = confirm(
        'Confermi il riavvio del server? La UI verrà ricaricata automaticamente.'
      );
      if (!confirmed) return;
      clearRestartTimers();
      setRestartStatus(null);
      setRestartCountdown(null);
      try {
        await api.adminServerRestart(adminToken);
        setRestartStatus({
          type: 'info',
          message: 'Riavvio avviato. La UI si ricaricherà automaticamente.'
        });
        setRestartCountdown(RESTART_DELAY_SECONDS);
        restartIntervalRef.current = setInterval(() => {
          setRestartCountdown((prev) => {
            if (prev === null) return prev;
            if (prev <= 1) {
              if (restartIntervalRef.current) {
                clearInterval(restartIntervalRef.current);
                restartIntervalRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        restartTimeoutRef.current = setTimeout(() => {
          window.location.reload();
        }, RESTART_DELAY_SECONDS * 1000);
      } catch (err) {
        setRestartStatus({
          type: 'error',
          message: err.message || 'Errore durante il riavvio del server'
        });
      }
    };

    const handleLdapTest = async () => {
      if (!adminToken) return;
      setLdapTesting(true);
      setLdapTestStatus(null);
      try {
        const result = await api.testLdapConnection(ldapConfig, ldapTestUserId || null, adminToken);
        setLdapTestStatus({
          type: 'success',
          message: result.message || 'Test LDAP completato con successo'
        });
      } catch (err) {
        let message = err.message || 'Test LDAP fallito';
        let type = 'error';
        if (err.code === 'GROUP_REQUIRED') {
          message = 'Utente non presente nel gruppo richiesto';
          type = 'warning';
        } else if (err.code === 'LDAP_DOWN') {
          message = 'Server LDAP non raggiungibile';
          type = 'warning';
        } else if (err.code === 'LDAP_CONFIG_ERROR') {
          message = 'Configurazione LDAP incompleta';
          type = 'warning';
        } else if (err.code === 'USER_NOT_FOUND') {
          message = 'Utente di test non trovato';
          type = 'warning';
        }
        setLdapTestStatus({ type, message });
      } finally {
        setLdapTesting(false);
      }
    };

    const readFileAsText = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere il file'));
      reader.readAsText(file);
    });

    const handleModularExport = async () => {
      if (!canUseModules) return;
      await onAdminModularExport(modules);
    };

    const handleModularImport = async (file) => {
      if (!file || !canUseModules) return;
      try {
        const text = await readFileAsText(file);
        const backup = JSON.parse(text);
        const overwrite = confirm(
          `Importare le impostazioni selezionate?\n\n` +
          `Moduli: ${modulesSummary}\n` +
          `ATTENZIONE: i dati importati sovrascriveranno quelli esistenti.\n\n` +
          `Confermi l'import?`
        );
        if (overwrite) {
          await onAdminModularImport({ backup, modules, overwriteExisting: true });
        }
      } catch (err) {
        alert(`Errore nella lettura del file: ${err.message}`);
      }
    };

    const formatBytes = (value) => {
      if (value === null || value === undefined) return '-';
      if (value === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const index = Math.floor(Math.log(value) / Math.log(1024));
      const size = value / Math.pow(1024, index);
      return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
    };

    const formatUptime = (seconds) => {
      if (seconds === null || seconds === undefined) return '-';
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const parts = [];
      if (hrs) parts.push(`${hrs}h`);
      if (mins || hrs) parts.push(`${mins}m`);
      parts.push(`${secs}s`);
      return parts.join(' ');
    };

    const formattedStartedAt = systemStatus?.server?.startedAt
      ? new Date(systemStatus.server.startedAt).toLocaleString('it-IT')
      : '-';

    return (
      <div className="card">
        <div className="settings-header">
          <h2 className="card-title settings-title">Impostazioni di sistema</h2>
          <button className="btn-secondary" onClick={onBack}>Torna alla timeline</button>
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">Configurazioni</h3>
          <p className="settings-section-description text-muted">
            Gestisci parametri globali, policy di sicurezza e opzioni di default.
          </p>
          <div className="settings-section-actions">
            <button
              className="btn-success"
              type="button"
              onClick={handleSaveSystemConfig}
              disabled={!adminToken || configSaving || ldapLoading}
            >
              {configSaving ? 'Salvataggio...' : 'Salva configurazioni'}
            </button>
            {configStatus && (
              <div className={`alert-item ${configStatus.type}`} style={{ margin: 0 }}>
                {configStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">Stato server e ambiente</h3>
          <p className="settings-section-description text-muted">
            Visualizza lo stato del server applicativo e dell&apos;ambiente in esecuzione.
          </p>
          <div className="settings-section-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => loadSystemStatus()}
              disabled={!adminToken || systemStatusLoading}
            >
              {systemStatusLoading ? 'Aggiornamento...' : 'Aggiorna stato'}
            </button>
            {systemStatusError && (
              <div className="alert-item error" style={{ margin: 0 }}>
                {systemStatusError}
              </div>
            )}
          </div>
          <div className="settings-status-grid" aria-live="polite">
            <div className="settings-status-item">
              <span className="settings-status-label">Stato server</span>
              <span className="settings-status-value">
                {systemStatus?.server?.status === 'online' ? 'Operativo' : 'Non disponibile'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Uptime</span>
              <span className="settings-status-value">
                {formatUptime(systemStatus?.server?.uptimeSeconds)}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Avvio server</span>
              <span className="settings-status-value">{formattedStartedAt}</span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Versione applicazione</span>
              <span className="settings-status-value">
                {systemStatus?.app?.version || '-'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Node.js</span>
              <span className="settings-status-value">
                {systemStatus?.server?.nodeVersion || '-'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Ambiente</span>
              <span className="settings-status-value">
                {systemStatus?.environment?.nodeEnv || '-'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Hostname</span>
              <span className="settings-status-value">
                {systemStatus?.environment?.hostname || '-'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Piattaforma</span>
              <span className="settings-status-value">
                {systemStatus?.environment?.platform || '-'} {systemStatus?.environment?.arch || ''}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">CPU</span>
              <span className="settings-status-value">
                {systemStatus?.environment?.cpuCount ? `${systemStatus.environment.cpuCount} core` : '-'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Memoria heap</span>
              <span className="settings-status-value">
                {formatBytes(systemStatus?.environment?.heapUsed)} / {formatBytes(systemStatus?.environment?.heapTotal)}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Memoria RSS</span>
              <span className="settings-status-value">
                {formatBytes(systemStatus?.environment?.memoryRss)}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Memoria libera</span>
              <span className="settings-status-value">
                {formatBytes(systemStatus?.environment?.freeMemory)} / {formatBytes(systemStatus?.environment?.totalMemory)}
              </span>
            </div>
          </div>
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">LDAP</h3>
          <p className="settings-section-description text-muted">
            Configura l'integrazione LDAP in modo persistente. Le modifiche salvate vengono usate per l'autenticazione.
          </p>
          <h4 className="settings-section-subtitle">Stato e fallback</h4>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ldapConfig.enabled}
                onChange={(e) => handleLdapFieldChange('enabled', e.target.checked)}
                disabled={ldapLoading}
              />
              LDAP abilitato (LDAP_ENABLED)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ldapConfig.log}
                onChange={(e) => handleLdapFieldChange('log', e.target.checked)}
                disabled={ldapLoading}
              />
              Log LDAP (LOG_LDAP)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ldapConfig.localFallback}
                onChange={(e) => handleLdapFieldChange('localFallback', e.target.checked)}
                disabled={ldapLoading}
              />
              Fallback locale (LDAP_LOCAL_FALLBACK)
            </label>
          </div>
          <h4 className="settings-section-subtitle">Connessione</h4>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="ldap-url">URL LDAP (LDAP_URL)</label>
              <input
                id="ldap-url"
                type="text"
                value={ldapConfig.url}
                onChange={(e) => handleLdapFieldChange('url', e.target.value)}
                placeholder="ldap://server:389"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="ldap-base-dn">Base DN (LDAP_BASE_DN)</label>
              <input
                id="ldap-base-dn"
                type="text"
                value={ldapConfig.baseDn}
                onChange={(e) => handleLdapFieldChange('baseDn', e.target.value)}
                placeholder="DC=example,DC=local"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="ldap-bind-dn">Bind DN (LDAP_BIND_DN)</label>
              <input
                id="ldap-bind-dn"
                type="text"
                value={ldapConfig.bindDn}
                onChange={(e) => handleLdapFieldChange('bindDn', e.target.value)}
                placeholder="CN=svc,OU=Users,DC=example,DC=local"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="ldap-bind-password">Bind Password (LDAP_BIND_PASSWORD)</label>
              <input
                id="ldap-bind-password"
                type="password"
                value={ldapConfig.bindPassword}
                onChange={(e) => handleLdapFieldChange('bindPassword', e.target.value)}
                placeholder="••••••••"
                disabled={ldapLoading}
              />
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                {ldapHasSavedBindPassword ? 'Password già salvata. Lascia vuoto per mantenerla.' : 'Inserisci la password per salvarla.'}
              </p>
            </div>
          </div>
          <h4 className="settings-section-subtitle">Filtri e gruppi</h4>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="ldap-user-filter">User Filter (LDAP_USER_FILTER)</label>
              <input
                id="ldap-user-filter"
                type="text"
                value={ldapConfig.userFilter}
                onChange={(e) => handleLdapFieldChange('userFilter', e.target.value)}
                placeholder="(sAMAccountName={{username}})"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="ldap-required-group">Required Group (LDAP_REQUIRED_GROUP)</label>
              <input
                id="ldap-required-group"
                type="text"
                value={ldapConfig.requiredGroupDn}
                onChange={(e) => handleLdapFieldChange('requiredGroupDn', e.target.value)}
                placeholder="CN=OnlyGantt,OU=Groups,DC=example,DC=local"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="ldap-group-search">Group Search Base (LDAP_GROUP_SEARCH_BASE)</label>
              <input
                id="ldap-group-search"
                type="text"
                value={ldapConfig.groupSearchBase}
                onChange={(e) => handleLdapFieldChange('groupSearchBase', e.target.value)}
                placeholder="OU=Groups,DC=example,DC=local"
                disabled={ldapLoading}
              />
            </div>
          </div>
          <h4 className="settings-section-subtitle">Test</h4>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="ldap-test-user">Utente per test</label>
              <input
                id="ldap-test-user"
                type="text"
                value={ldapTestUserId}
                onChange={(e) => setLdapTestUserId(e.target.value)}
                placeholder="username"
                disabled={ldapLoading}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-success" type="button" onClick={handleLdapTest} disabled={ldapTesting || ldapLoading}>
              {ldapTesting ? 'Test in corso...' : 'Test bind/search'}
            </button>
            {ldapTestStatus && (
              <div className={`alert-item ${ldapTestStatus.type}`} style={{ margin: 0 }}>
                {ldapTestStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">HTTPS</h3>
          <p className="settings-section-description text-muted">
            Configura HTTPS in modo persistente. Dopo il salvataggio è necessario riavviare il server.
          </p>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={httpsConfig.enabled}
                onChange={(e) => handleHttpsFieldChange('enabled', e.target.checked)}
                disabled={ldapLoading}
              />
              HTTPS abilitato (HTTPS_ENABLED)
            </label>
          </div>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="https-key-path">Path chiave privata (HTTPS_KEY_PATH)</label>
              <input
                id="https-key-path"
                type="text"
                value={httpsConfig.keyPath}
                onChange={(e) => handleHttpsFieldChange('keyPath', e.target.value)}
                placeholder="/etc/ssl/private/server.key"
                disabled={ldapLoading}
              />
            </div>
            <div>
              <label htmlFor="https-cert-path">Path certificato (HTTPS_CERT_PATH)</label>
              <input
                id="https-cert-path"
                type="text"
                value={httpsConfig.certPath}
                onChange={(e) => handleHttpsFieldChange('certPath', e.target.value)}
                placeholder="/etc/ssl/certs/server.crt"
                disabled={ldapLoading}
              />
            </div>
          </div>
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">Manutenzione server</h3>
          <p className="settings-section-description text-muted">
            Operazioni amministrative per mantenere il server operativo.
          </p>
          <div className="settings-section-actions">
            <button
              className="btn-danger"
              type="button"
              onClick={handleServerRestart}
              disabled={!adminToken || restartCountdown !== null}
            >
              Riavvia server
            </button>
          </div>
          {restartCountdown !== null && (
            <div className="alert-item info" style={{ marginTop: '0.75rem' }}>
              Riavvio in corso: ricarico della UI tra {restartCountdown} secondi.
            </div>
          )}
          {restartStatus && restartCountdown === null && (
            <div className={`alert-item ${restartStatus.type}`} style={{ marginTop: '0.75rem' }}>
              {restartStatus.message}
            </div>
          )}
        </div>

        <div className="card-section settings-section">
          <h3 className="settings-section-title">Import/Export impostazioni</h3>
          <p className="settings-section-description text-muted">
            Gestisci esportazioni e importazioni per reparto e per moduli di configurazione disponibili.
          </p>
          <h4 className="settings-section-subtitle">Moduli globali</h4>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {Object.keys(moduleLabels).map((key) => (
              <label key={key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={modules[key]}
                  onChange={() => handleModuleToggle(key)}
                />
                {moduleLabels[key]}
              </label>
            ))}
          </div>
          <div className="alert-item info" style={{ marginTop: '0.75rem' }}>
            Moduli selezionati: {modulesSummary}
          </div>
          <div className="alert-item warning" style={{ marginTop: '0.75rem' }}>
            Import disponibile per reparti, utenti e impostazioni. Le integrazioni non sono esposte.
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
    );
  }

  window.OnlyGantt.components.SystemSettings = SystemSettings;
})();
