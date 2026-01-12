(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function SystemSettings({ onBack }) {
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
        </div>
      </div>
    );
  }

  window.OnlyGantt.components.SystemSettings = SystemSettings;
})();
