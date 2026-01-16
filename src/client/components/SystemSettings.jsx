(function() {
  'use strict';

  const { useMemo, useState, useEffect, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function SystemSettings({
    onBack,
    department,
    canImportExport,
    readOnlyDepartment,
    onExportDepartment,
    onImportDepartment,
    onAdminServerBackup,
    onAdminServerRestore,
    onAdminModularExport,
    onAdminModularImport,
    adminToken
  }) {
    const api = window.OnlyGantt.api;
    const [modules, setModules] = useState({
      departments: true,
      users: false,
      settings: false,
      integrations: false
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
      settings: 'Impostazioni',
      integrations: 'Integrazioni'
    };

    const selectedModules = useMemo(
      () => Object.keys(modules).filter((key) => modules[key]),
      [modules]
    );

    const modulesSummary = selectedModules.length
      ? selectedModules.map((key) => moduleLabels[key] || key).join(', ')
      : 'Nessun modulo selezionato';

    const canUseDepartmentTools = !!department && canImportExport && !readOnlyDepartment;
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
        if (err.code === 'GROUP_REQUIRED') {
          message = 'Utente non presente nel gruppo richiesto';
        } else if (err.code === 'LDAP_DOWN') {
          message = 'Server LDAP non raggiungibile';
        }
        setLdapTestStatus({ type: 'error', message });
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

    const handleServerRestore = async (file) => {
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const backup = JSON.parse(text);
        const overwrite = confirm(
          `Ripristinare il backup del server?\n\n` +
          `Reparti nel backup: ${backup.departments?.length || 0}\n` +
          `Data export: ${backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('it-IT') : 'N/A'}\n\n` +
          `ATTENZIONE: I reparti esistenti verranno sovrascritti!\n\n` +
          `Confermi il ripristino?`
        );
        if (overwrite) {
          await onAdminServerRestore({ backup, overwriteExisting: true });
        }
      } catch (err) {
        alert(`Errore nella lettura del file: ${err.message}`);
      }
    };

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
          `Importare i moduli selezionati?\n\n` +
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

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 className="card-title">Impostazioni di sistema</h2>
          <button className="btn-secondary" onClick={onBack}>Torna alla timeline</button>
        </div>

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>Configurazioni</h3>
          <p className="text-muted">Gestisci parametri globali, policy di sicurezza e opzioni di default.</p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>LDAP</h3>
          <p className="text-muted">
            Configura l'integrazione LDAP in modo persistente. Le modifiche salvate vengono usate per l'autenticazione.
          </p>
          <h4 style={{ margin: '0.75rem 0 0.5rem' }}>Stato e fallback</h4>
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
          <h4 style={{ margin: '0.75rem 0 0.5rem' }}>Connessione</h4>
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
          <h4 style={{ margin: '0.75rem 0 0.5rem' }}>Filtri e gruppi</h4>
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
          <h4 style={{ margin: '0.75rem 0 0.5rem' }}>Test</h4>
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

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>HTTPS</h3>
          <p className="text-muted">
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

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>Integrazioni</h3>
          <p className="text-muted">Collega servizi esterni, webhook e strumenti di reporting.</p>
        </div>

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>Strumenti admin</h3>
          <p className="text-muted">Utility avanzate per manutenzione, backup e monitoraggio.</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-success" onClick={onAdminServerBackup}>
              Esporta backup completo
            </button>
            <label className="btn-secondary" style={{ margin: 0, cursor: 'pointer' }}>
              Ripristina backup
              <input
                type="file"
                accept=".json"
                onChange={(event) => {
                  const file = event.target.files[0];
                  if (file) {
                    handleServerRestore(file);
                    event.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
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

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>Export/Import reparto</h3>
          <p className="text-muted">Esporta o importa i dati del reparto selezionato.</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-success"
              onClick={onExportDepartment}
              disabled={!canUseDepartmentTools}
            >
              Esporta reparto
            </button>
            <label className="btn-secondary" style={{ margin: 0, cursor: canUseDepartmentTools ? 'pointer' : 'default', opacity: canUseDepartmentTools ? 1 : 0.6 }}>
              Importa reparto
              <input
                type="file"
                accept=".json"
                disabled={!canUseDepartmentTools}
                onChange={(event) => {
                  const file = event.target.files[0];
                  if (file) {
                    onImportDepartment(file);
                    event.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="card-section">
          <h3 style={{ marginTop: 0 }}>Import/Export modulare</h3>
          <p className="text-muted">Seleziona i moduli da includere nel backup modulare.</p>
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
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button
              className="btn-success"
              onClick={handleModularExport}
              disabled={!canUseModules}
            >
              Esporta moduli
            </button>
            <label className="btn-secondary" style={{ margin: 0, cursor: canUseModules ? 'pointer' : 'default', opacity: canUseModules ? 1 : 0.6 }}>
              Importa moduli
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
