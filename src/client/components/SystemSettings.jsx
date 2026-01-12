(function() {
  'use strict';

  const { useMemo, useState } = React;

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
    onAdminModularImport
  }) {
    const [modules, setModules] = useState({
      departments: true,
      users: false,
      settings: false,
      integrations: false
    });

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
          </div>
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
