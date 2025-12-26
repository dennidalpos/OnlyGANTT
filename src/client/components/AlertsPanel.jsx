(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const { useState } = React;

  const logic = window.OnlyGantt.logic;

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

  function AlertsPanel({ projects }) {
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

      return (
        <div className="alert-section collapsible">
          <div
            className="collapsible-header"
            onClick={() => toggleSection(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection(key);
              }
            }}
          >
            <span className="alert-section-title" style={{ color }}>
              {title}
            </span>
            <span>{isCollapsed ? '+' : '−'}</span>
          </div>
          {!isCollapsed && (
            <div className="collapsible-content">
              {content}
            </div>
          )}
        </div>
      );
    };

    const allAlerts = {
      projectsDelayed: [],
      phasesDelayed: [],
      phasesOutsideRange: [],
      milestonesOutsideRange: [],
      phasesOnHoliday: [],
      phasesMissingDates: [],
      projectsNoPhases: [],
      projectsMissingDates: [],
      projectsPercentage100NotCompleted: []
    };

    projects.forEach(project => {
      const alerts = logic.getProjectAlerts(project);

      if (alerts.projectDelayed) {
        allAlerts.projectsDelayed.push(project);
      }

      if (alerts.noPhases) {
        allAlerts.projectsNoPhases.push(project);
      }

      if (alerts.projectMissingDates) {
        allAlerts.projectsMissingDates.push(project);
      }

      if (alerts.percentage100NotCompleted) {
        allAlerts.projectsPercentage100NotCompleted.push(project);
      }

      alerts.phasesDelayed.forEach(fase => {
        allAlerts.phasesDelayed.push({ project, fase });
      });

      alerts.phasesOutsideRange.forEach(fase => {
        allAlerts.phasesOutsideRange.push({ project, fase });
      });

      alerts.milestonesOutsideRange.forEach(fase => {
        allAlerts.milestonesOutsideRange.push({ project, fase });
      });

      alerts.phasesOnHoliday.forEach(fase => {
        allAlerts.phasesOnHoliday.push({ project, fase });
      });

      alerts.phasesMissingDates.forEach(fase => {
        allAlerts.phasesMissingDates.push({ project, fase });
      });
    });

    const totalAlerts = Object.values(allAlerts).reduce((sum, arr) => sum + arr.length, 0);

    return (
      <div className="card">
        <h2 className="card-title">Alert ({totalAlerts})</h2>

        {totalAlerts === 0 ? (
          <p className="text-muted text-center">Nessun alert</p>
        ) : (
          <div>
            {[
              {
                key: 'projectsDelayed',
                title: `Progetti in Ritardo (${allAlerts.projectsDelayed.length})`,
                color: 'var(--error)',
                items: allAlerts.projectsDelayed,
                content: allAlerts.projectsDelayed.map(project => (
                  <div key={project.id} className="alert-item">
                    <strong>{project.nome}</strong><br />
                    Scadenza: {project.dataFine}
                  </div>
                ))
              },
              {
                key: 'phasesDelayed',
                title: `Fasi in Ritardo (${allAlerts.phasesDelayed.length})`,
                color: 'var(--error)',
                items: allAlerts.phasesDelayed,
                content: allAlerts.phasesDelayed.map((item, index) => (
                  <div key={index} className="alert-item">
                    <strong>{item.fase.nome}</strong> ({item.project.nome})<br />
                    Scadenza: {item.fase.dataFine}
                  </div>
                ))
              },
              {
                key: 'phasesOutsideRange',
                title: `Fasi Fuori Range Progetto (${allAlerts.phasesOutsideRange.length})`,
                color: 'var(--warning)',
                items: allAlerts.phasesOutsideRange,
                content: allAlerts.phasesOutsideRange.map((item, index) => (
                  <div key={index} className="alert-item warning">
                    <strong>{item.fase.nome}</strong> ({item.project.nome})<br />
                    Fase: {item.fase.dataInizio} - {item.fase.dataFine}<br />
                    Progetto: {item.project.dataInizio} - {item.project.dataFine}
                  </div>
                ))
              },
              {
                key: 'milestonesOutsideRange',
                title: `Milestone Fuori Range Progetto (${allAlerts.milestonesOutsideRange.length})`,
                color: 'var(--warning)',
                items: allAlerts.milestonesOutsideRange,
                content: allAlerts.milestonesOutsideRange.map((item, index) => (
                  <div key={index} className="alert-item warning">
                    <strong>{item.fase.nome}</strong> ({item.project.nome})<br />
                    Milestone: {item.fase.dataFine}<br />
                    Progetto: {item.project.dataInizio} - {item.project.dataFine}
                  </div>
                ))
              },
              {
                key: 'phasesMissingDates',
                title: `Fasi Senza Date (${allAlerts.phasesMissingDates.length})`,
                color: 'var(--warning)',
                items: allAlerts.phasesMissingDates,
                content: allAlerts.phasesMissingDates.map((item, index) => (
                  <div key={index} className="alert-item warning">
                    <strong>{item.fase.nome}</strong> ({item.project.nome})
                  </div>
                ))
              },
              {
                key: 'projectsNoPhases',
                title: `Progetti Senza Fasi (${allAlerts.projectsNoPhases.length})`,
                color: 'var(--warning)',
                items: allAlerts.projectsNoPhases,
                content: allAlerts.projectsNoPhases.map(project => (
                  <div key={project.id} className="alert-item warning">
                    <strong>{project.nome}</strong>
                  </div>
                ))
              },
              {
                key: 'projectsMissingDates',
                title: `Progetti Senza Date (${allAlerts.projectsMissingDates.length})`,
                color: 'var(--warning)',
                items: allAlerts.projectsMissingDates,
                content: allAlerts.projectsMissingDates.map(project => (
                  <div key={project.id} className="alert-item warning">
                    <strong>{project.nome}</strong>
                  </div>
                ))
              },
              {
                key: 'projectsPercentage100NotCompleted',
                title: `Progetti 100% Non Completati (${allAlerts.projectsPercentage100NotCompleted.length})`,
                color: 'var(--warning)',
                items: allAlerts.projectsPercentage100NotCompleted,
                content: allAlerts.projectsPercentage100NotCompleted.map(project => (
                  <div key={project.id} className="alert-item warning">
                    <strong>{project.nome}</strong><br />
                    Percentuale: {logic.calculateProjectPercentage(project)}%<br />
                    Stato: {project.stato}
                  </div>
                ))
              },
              {
                key: 'phasesOnHoliday',
                title: `Fasi su Giorni Festivi (${allAlerts.phasesOnHoliday.length})`,
                color: 'var(--info)',
                items: allAlerts.phasesOnHoliday,
                content: allAlerts.phasesOnHoliday.map((item, index) => (
                  <div key={index} className="alert-item info">
                    <strong>{item.fase.nome}</strong> ({item.project.nome})<br />
                    {item.fase.dataInizio} - {item.fase.dataFine}
                  </div>
                ))
              }
            ].map(section => (
              section.items.length > 0
                ? renderSection(section.key, section.title, section.color, section.content)
                : null
            ))}
          </div>
        )}
      </div>
    );
  }

  window.OnlyGantt.components.AlertsPanel = AlertsPanel;
})();
