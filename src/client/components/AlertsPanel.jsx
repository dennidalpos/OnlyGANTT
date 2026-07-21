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

export function AlertsPanel({ projects }) {
  const [collapsedSections, setCollapsedSections] = useState(() => new Set(alertSectionKeys));

  const toggleSection = (key) => {
    const next = new Set(collapsedSections);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCollapsedSections(next);
  };

  const renderSection = (key, title, color, content) => {
    const isCollapsed = collapsedSections.has(key);
    const contentId = `alerts-section-${key}`;

    return (
      <div key={key} style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => toggleSection(key)}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'inherit',
            padding: '0.25rem 0',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span style={{ fontWeight: '600', color }}>{title}</span>
          <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            {isCollapsed ? '▼ Espandi' : '▲ Comprimi'}
          </span>
        </button>

        {!isCollapsed && (
          <div id={contentId} style={{ marginTop: '0.5rem' }}>
            {content}
          </div>
        )}
      </div>
    );
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

  if (totalErrors === 0 && totalWarnings === 0 && totalInfos === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Segnalazioni Dati</h2>
        <p className="text-muted">Nessuna segnalazione rilevata per i progetti correnti.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Segnalazioni Dati</h2>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
        {totalErrors > 0 && <span style={{ color: '#ef4444' }}>⚠ {totalErrors} Errori</span>}
        {totalWarnings > 0 && <span style={{ color: '#f59e0b' }}>⚠ {totalWarnings} Avvisi</span>}
        {totalInfos > 0 && <span style={{ color: '#3b82f6' }}>ℹ {totalInfos} Info</span>}
      </div>

      {projectsDelayed.length > 0 && renderSection(
        'projectsDelayed',
        `Progetti in Ritardo (${projectsDelayed.length})`,
        '#ef4444',
        projectsDelayed.map(item => (
          <div key={item.project.id} className="alert-item error">
            Progetto <strong>{item.project.nome}</strong> in ritardo (scadenza: {item.project.dataFine})
          </div>
        ))
      )}

      {phasesDelayed.length > 0 && renderSection(
        'phasesDelayed',
        `Fasi in Ritardo (${phasesDelayed.length} progetti)`,
        '#ef4444',
        phasesDelayed.map(item => (
          <div key={item.project.id} className="alert-item error">
            Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesDelayed.map(f => f.nome).join(', ')} in ritardo
          </div>
        ))
      )}

      {phasesOutsideRange.length > 0 && renderSection(
        'phasesOutsideRange',
        `Fasi fuori range progetto (${phasesOutsideRange.length} progetti)`,
        '#ef4444',
        phasesOutsideRange.map(item => (
          <div key={item.project.id} className="alert-item error">
            Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesOutsideRange.map(f => f.nome).join(', ')} fuori range
          </div>
        ))
      )}

      {milestonesOutsideRange.length > 0 && renderSection(
        'milestonesOutsideRange',
        `Milestone fuori range (${milestonesOutsideRange.length} progetti)`,
        '#ef4444',
        milestonesOutsideRange.map(item => (
          <div key={item.project.id} className="alert-item error">
            Progetto <strong>{item.project.nome}</strong>: {item.alerts.milestonesOutsideRange.map(f => f.nome).join(', ')} fuori range
          </div>
        ))
      )}

      {projectsPercentage100NotCompleted.length > 0 && renderSection(
        'projectsPercentage100NotCompleted',
        `100% Non Completati (${projectsPercentage100NotCompleted.length})`,
        '#ef4444',
        projectsPercentage100NotCompleted.map(item => (
          <div key={item.project.id} className="alert-item error">
            Progetto <strong>{item.project.nome}</strong> a 100% ma non completato
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
        `Fasi in festivi (${phasesOnHoliday.length} progetti)`,
        '#3b82f6',
        phasesOnHoliday.map(item => (
          <div key={item.project.id} className="alert-item info">
            Progetto <strong>{item.project.nome}</strong>: {item.alerts.phasesOnHoliday.map(f => f.nome).join(', ')} in giorno festivo
          </div>
        ))
      )}
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.AlertsPanel = AlertsPanel;
}

export default AlertsPanel;
