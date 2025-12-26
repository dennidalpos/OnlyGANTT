(function() {
  'use strict';

  const { useState, useEffect, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const logic = window.OnlyGantt.logic;
  const config = window.AppConfig;

  function ProjectList({
    projects,
    selectedProjectIds,
    onSelectedProjectIdsChange,
    onEditProject,
    onDeleteProject,
    onImportJSON,
    onExportJSON,
    validationErrors = [],
    readOnly,
    isSaving,
    focusedProjectId,
    onFocusHandled
  }) {
    const [expandedProjects, setExpandedProjects] = useState(new Set());
    const [highlightedProjectId, setHighlightedProjectId] = useState(null);
    const projectRefs = useRef({});
    const highlightTimerRef = useRef(null);

    useEffect(() => {
      if (!focusedProjectId) return;
      const target = projectRefs.current[focusedProjectId];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedProjectId(null);
        window.requestAnimationFrame(() => {
          setHighlightedProjectId(focusedProjectId);
        });
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedProjectId(null);
        }, 5000);
      }
      if (onFocusHandled) {
        onFocusHandled();
      }
    }, [focusedProjectId, onFocusHandled]);

    useEffect(() => () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    }, []);

    const toggleExpand = (projectId) => {
      const newExpanded = new Set(expandedProjects);
      if (newExpanded.has(projectId)) {
        newExpanded.delete(projectId);
      } else {
        newExpanded.add(projectId);
      }
      setExpandedProjects(newExpanded);
    };

    const toggleProjectInGantt = (projectId) => {
      const newSelected = new Set(selectedProjectIds);
      if (newSelected.has(projectId)) {
        newSelected.delete(projectId);
      } else {
        newSelected.add(projectId);
      }
      onSelectedProjectIdsChange(newSelected);
    };

    const selectAllInGantt = () => {
      const allIds = new Set(projects.map(p => p.id));
      onSelectedProjectIdsChange(allIds);
    };

    const deselectAllInGantt = () => {
      onSelectedProjectIdsChange(new Set());
    };

    const allSelected = projects.length > 0 && selectedProjectIds.size === projects.length;

    return (
      <div className="card">
        <h2 className="card-title">Elenco Progetti</h2>

        {validationErrors.length > 0 && (
          <div className="card-section">
            <div className="alert-item warning">
              Sono stati rilevati errori nei dati dei progetti:
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                {validationErrors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="card-section">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#cbd5e1' }}>Strumenti</h3>
          <div className="text-muted text-small" style={{ marginBottom: '0.5rem' }}>
            Import/Export progetti per trasferirli su un altro reparto.
          </div>

          <div className="button-group" style={{ marginBottom: '0.5rem' }}>
            <label className="checkbox-label compact">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => (e.target.checked ? selectAllInGantt() : deselectAllInGantt())}
                disabled={projects.length === 0}
              />
              Visualizza tutti i progetti su diagramma
            </label>
          </div>

          <div className="button-group" style={{ marginBottom: '0.5rem' }}>
            <label
              className={`btn-secondary btn-small ${readOnly ? 'btn-disabled' : ''}`}
              style={{ cursor: readOnly ? 'not-allowed' : 'pointer', margin: 0 }}
              aria-disabled={readOnly}
            >
              Importa progetti
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  if (readOnly) return;
                  const file = e.target.files[0];
                  if (file) {
                    onImportJSON(file);
                    e.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
                disabled={readOnly}
              />
            </label>
            <button onClick={onExportJSON} className="btn-secondary btn-small">
              Export Progetti
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="text-muted text-center">Nessun progetto</p>
        ) : (
          <div>
            {projects.map(project => {
              const percentage = logic.calculateProjectPercentage(project);
              const summary = logic.getPhasesSummary(project);
              const alerts = logic.getProjectAlerts(project);
              const severity = logic.getProjectAlertSeverity(alerts);
              const severityClass = ` project-item-alert-${severity || 'success'}`;
              const isExpanded = expandedProjects.has(project.id);
              const isSelected = selectedProjectIds.has(project.id);

              return (
                <div
                  key={project.id}
                  ref={(el) => {
                    if (el) {
                      projectRefs.current[project.id] = el;
                    }
                  }}
                  className={`project-item${severityClass}${highlightedProjectId === project.id ? ' project-item-highlight' : ''}`}
                >
                  <div className="project-header">
                    <div>
                      <h3 className="project-name">
                        <span
                          style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            backgroundColor: project.colore,
                            marginRight: '0.5rem',
                            borderRadius: '2px'
                          }}
                        />
                        {project.nome}
                      </h3>
                    </div>
                    <span className={`badge badge-${project.stato === 'completato' ? 'success' : project.stato === 'in_ritardo' ? 'error' : 'info'}`}>
                      {config.stateLabels[project.stato]}
                    </span>
                  </div>

                  <div className="project-info">
                    <div>
                      {project.dataInizio || '?'} — {project.dataFine || '?'}
                    </div>
                    <div>
                      Completamento: {percentage}%
                    </div>
                    <div>
                      Fasi: {summary.completed}/{summary.total} completate
                      {summary.delayed > 0 && (
                        <span style={{ color: 'var(--error)', marginLeft: '0.5rem' }}>
                          ({summary.delayed} in ritardo)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="project-actions">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProjectInGantt(project.id)}
                      />
                      In Gantt
                    </label>

                    {!readOnly && (
                      <>
                        <button
                          onClick={() => onEditProject(project)}
                          className="btn-secondary btn-small"
                          disabled={isSaving}
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => onDeleteProject(project.id)}
                          className="btn-danger btn-small"
                          disabled={isSaving}
                        >
                          Elimina
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="btn-secondary btn-small"
                    >
                      {isExpanded ? 'Nascondi' : 'Dettagli'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="phase-list">
                      {project.fasi && project.fasi.length > 0 ? (
                        project.fasi.map((fase) => (
                          <div key={fase.id} className={`phase-item state-${fase.stato} ${fase.milestone ? 'milestone' : ''}`}>
                            <div className="phase-name">
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: fase.colore || project.colore || '#64748b',
                                  marginRight: '0.4rem',
                                  borderRadius: '2px'
                                }}
                              />
                              {fase.milestone && '💎 '}
                              {fase.nome}
                            </div>
                            <div className="phase-info">
                              {fase.dataInizio || '?'} — {fase.dataFine || '?'} | {config.stateLabels[fase.stato]} | {(fase.percentualeCompletamento ?? 0)}%
                              {logic.isDelayed(fase) && (
                                <span style={{ color: 'var(--error)', marginLeft: '0.5rem' }}>IN RITARDO</span>
                              )}
                            </div>
                            {fase.note && (
                              <div className="phase-info" style={{ fontStyle: 'italic', marginTop: '0.25rem' }}>
                                Note: {fase.note}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted text-small">Nessuna fase</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  window.OnlyGantt.components.ProjectList = ProjectList;
})();
