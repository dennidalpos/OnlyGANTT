import logic from '../../domain/projectLogic.js';

const { useState } = React;

const alertSectionKeys = [
  'projectsDelayed',
  'phasesDelayed',
  'phasesOutsideRange',
  'milestonesOutsideRange',
  'phasesOnHoliday',
  'phasesMissingDates',
  'projectsNoPhases',
  'projectsMissingDates',
  'projectsPercentage100NotCompleted'
];

export function AlertsDrawer({
  isOpen,
  onClose,
  projects,
  onEditProject,
  onFixErrors
}) {
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());

  if (!isOpen) return null;

  const toggleSection = (key) => {
    const next = new Set(collapsedSections);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCollapsedSections(next);
  };

  const allAlerts = projects.map(p => ({
    project: p,
    alerts: logic.getProjectAlerts(p)
  }));

  const projectsDelayed = allAlerts.filter(a => a.alerts.projectDelayed);
  const phasesDelayed = allAlerts.filter(a => a.alerts.phasesDelayed.length > 0);
  const phasesOutsideRange = allAlerts.filter(a => a.alerts.phasesOutsideRange.length > 0);
  const milestonesOutsideRange = allAlerts.filter(a => a.alerts.milestonesOutsideRange.length > 0);
  const phasesOnHoliday = allAlerts.filter(a => a.alerts.phasesOnHoliday.length > 0);
  const phasesMissingDates = allAlerts.filter(a => a.alerts.phasesMissingDates.length > 0);
  const projectsNoPhases = allAlerts.filter(a => a.alerts.noPhases);
  const projectsMissingDates = allAlerts.filter(a => a.alerts.projectMissingDates);
  const projectsPercentage100NotCompleted = allAlerts.filter(a => a.alerts.percentage100NotCompleted);

  const totalErrors = projectsDelayed.length + phasesDelayed.length + phasesOutsideRange.length + milestonesOutsideRange.length + projectsPercentage100NotCompleted.length;
  const totalWarnings = projectsNoPhases.length + projectsMissingDates.length + phasesMissingDates.length;
  const totalInfos = phasesOnHoliday.length;

  const renderSection = (key, title, color, content) => {
    const isCollapsed = collapsedSections.has(key);
    return (
      <div key={key} style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => toggleSection(key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'var(--surface-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'inherit',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span style={{ fontWeight: '600', color, fontSize: '0.85rem' }}>{title}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isCollapsed ? '▼ Espandi' : '▲ Comprimi'}
          </span>
        </button>

        {!isCollapsed && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="slide-over-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <span>🛡</span> Salute Dati & Segnalazioni
          </h3>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.85rem' }}>⚠ {totalErrors} Errori</span>
            <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '0.85rem' }}>⚠ {totalWarnings} Avvisi</span>
            <span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '0.85rem' }}>ℹ {totalInfos} Info</span>
          </div>

          {totalErrors === 0 && totalWarnings === 0 && totalInfos === 0 ? (
            <div className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
              <p>Nessun errore o segnalazione rilevata. I dati dei progetti sono coerenti!</p>
            </div>
          ) : (
            <>
              {projectsDelayed.length > 0 && renderSection(
                'projectsDelayed',
                `Progetti in Ritardo (${projectsDelayed.length})`,
                '#ef4444',
                projectsDelayed.map(item => (
                  <div key={item.project.id} className="alert-item error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Progetto <strong>{item.project.nome}</strong> in ritardo (scadenza: {item.project.dataFine})</span>
                    {onEditProject && (
                      <button type="button" className="btn-secondary btn-small" onClick={() => { onEditProject(item.project); onClose(); }}>Modifica</button>
                    )}
                  </div>
                ))
              )}

              {phasesDelayed.length > 0 && renderSection(
                'phasesDelayed',
                `Fasi in Ritardo (${phasesDelayed.length} progetti)`,
                '#ef4444',
                phasesDelayed.map(item => (
                  <div key={item.project.id} className="alert-item error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesDelayed.map(f => f.nome).join(', ')} in ritardo</span>
                    {onEditProject && (
                      <button type="button" className="btn-secondary btn-small" onClick={() => { onEditProject(item.project); onClose(); }}>Modifica</button>
                    )}
                  </div>
                ))
              )}

              {phasesOutsideRange.length > 0 && renderSection(
                'phasesOutsideRange',
                `Fasi fuori range (${phasesOutsideRange.length} progetti)`,
                '#ef4444',
                phasesOutsideRange.map(item => (
                  <div key={item.project.id} className="alert-item error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesOutsideRange.map(f => f.nome).join(', ')} fuori range</span>
                    {onEditProject && (
                      <button type="button" className="btn-secondary btn-small" onClick={() => { onEditProject(item.project); onClose(); }}>Modifica</button>
                    )}
                  </div>
                ))
              )}

              {milestonesOutsideRange.length > 0 && renderSection(
                'milestonesOutsideRange',
                `Milestone fuori range (${milestonesOutsideRange.length} progetti)`,
                '#ef4444',
                milestonesOutsideRange.map(item => (
                  <div key={item.project.id} className="alert-item error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Progetto <strong>{item.project.nome}</strong>: {item.alerts.milestonesOutsideRange.map(f => f.nome).join(', ')} fuori range</span>
                    {onEditProject && (
                      <button type="button" className="btn-secondary btn-small" onClick={() => { onEditProject(item.project); onClose(); }}>Modifica</button>
                    )}
                  </div>
                ))
              )}

              {projectsPercentage100NotCompleted.length > 0 && renderSection(
                'projectsPercentage100NotCompleted',
                `100% Non Completati (${projectsPercentage100NotCompleted.length})`,
                '#ef4444',
                projectsPercentage100NotCompleted.map(item => (
                  <div key={item.project.id} className="alert-item error">
                    Progetto <strong>{item.project.nome}</strong> a 100% ma non segnato come completato
                  </div>
                ))
              )}

              {projectsMissingDates.length > 0 && renderSection(
                'projectsMissingDates',
                `Progetti senza date (${projectsMissingDates.length})`,
                '#f59e0b',
                projectsMissingDates.map(item => (
                  <div key={item.project.id} className="alert-item warning">
                    Progetto <strong>{item.project.nome}</strong> privo di data inizio o fine
                  </div>
                ))
              )}

              {projectsNoPhases.length > 0 && renderSection(
                'projectsNoPhases',
                `Progetti senza fasi (${projectsNoPhases.length})`,
                '#f59e0b',
                projectsNoPhases.map(item => (
                  <div key={item.project.id} className="alert-item warning">
                    Progetto <strong>{item.project.nome}</strong> senza fasi definite
                  </div>
                ))
              )}

              {phasesMissingDates.length > 0 && renderSection(
                'phasesMissingDates',
                `Fasi senza date (${phasesMissingDates.length} progetti)`,
                '#f59e0b',
                phasesMissingDates.map(item => (
                  <div key={item.project.id} className="alert-item warning">
                    Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesMissingDates.map(f => f.nome).join(', ')} senza date
                  </div>
                ))
              )}

              {phasesOnHoliday.length > 0 && renderSection(
                'phasesOnHoliday',
                `Fasi in giorni festivi (${phasesOnHoliday.length} progetti)`,
                '#3b82f6',
                phasesOnHoliday.map(item => (
                  <div key={item.project.id} className="alert-item info">
                    Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesOnHoliday.map(f => f.nome).join(', ')} in giorno festivo
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="drawer-footer">
          {onFixErrors && totalErrors > 0 && (
            <button type="button" className="btn-success btn-small" onClick={() => { onFixErrors(); onClose(); }}>
              Fix automatico
            </button>
          )}
          <button type="button" className="btn-secondary btn-small" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.AlertsDrawer = AlertsDrawer;
}

export default AlertsDrawer;
