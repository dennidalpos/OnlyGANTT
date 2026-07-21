import logic from '../../domain/projectLogic.js';
import AppConfig from '../../app-config.js';

const { useState, useEffect, useRef } = React;

export function ProjectList({
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
  const importFileInputRef = useRef(null);
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
      }, 1600);
      if (onFocusHandled) {
        onFocusHandled(focusedProjectId);
      }
    }
  }, [focusedProjectId, onFocusHandled]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const toggleSelectAll = () => {
    if (selectedProjectIds.size === projects.length) {
      onSelectedProjectIdsChange(new Set());
    } else {
      onSelectedProjectIdsChange(new Set(projects.map(p => p.id)));
    }
  };

  const toggleSelectProject = (id) => {
    const next = new Set(selectedProjectIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedProjectIdsChange(next);
  };

  const toggleExpand = (id) => {
    const next = new Set(expandedProjects);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedProjects(next);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImportJSON(file);
      e.target.value = '';
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          Elenco Progetti ({projects.length})
        </h2>
        <div className="button-group">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => onEditProject(null)}
                className="btn-success btn-small"
                disabled={isSaving}
              >
                + Nuovo Progetto
              </button>
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="btn-secondary btn-small"
                disabled={isSaving}
              >
                Importa JSON
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </>
          )}
          <button
            type="button"
            onClick={onExportJSON}
            className="btn-secondary btn-small"
            disabled={projects.length === 0}
          >
            Esporta JSON
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="alert-item warning" style={{ marginBottom: '1rem' }}>
          <strong>Segnalazioni validazione:</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-muted">Nessun progetto disponibile in questo reparto.</p>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <label className="checkbox-label" htmlFor="project-list-select-all">
              <input
                id="project-list-select-all"
                type="checkbox"
                checked={selectedProjectIds.size === projects.length && projects.length > 0}
                onChange={toggleSelectAll}
              />
              Seleziona tutti ({selectedProjectIds.size}/{projects.length})
            </label>
          </div>

          {projects.map((project) => {
            const isSelected = selectedProjectIds.has(project.id);
            const isExpanded = expandedProjects.has(project.id);
            const isHighlighted = highlightedProjectId === project.id;
            const percentage = logic.calculateProjectPercentage(project);
            const alerts = logic.getProjectAlerts(project);
            const severity = logic.getProjectAlertSeverity(alerts);
            const summary = logic.getPhasesSummary(project);

            return (
              <div
                key={project.id}
                ref={(el) => {
                  if (el) projectRefs.current[project.id] = el;
                }}
                className={`project-item ${isHighlighted ? 'project-item--highlighted' : ''}`}
                style={{
                  borderLeft: `4px solid ${project.colore || '#3b82f6'}`,
                  marginBottom: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectProject(project.id)}
                      aria-label={`Seleziona ${project.nome}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(project.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 4px' }}
                    >
                      {isExpanded ? '▼' : '►'}
                    </button>
                    <strong>{project.nome}</strong>

                    <span className={`badge badge--${project.stato}`}>
                      {AppConfig.stateLabels[project.stato] || project.stato}
                    </span>

                    {severity && (
                      <span className={`alert-badge alert-badge--${severity}`} title="Segnalazioni nel progetto">
                        ⚠
                      </span>
                    )}

                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {percentage}%
                    </span>
                  </div>

                  <div className="button-group">
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditProject(project)}
                          className="btn-secondary btn-small"
                          disabled={isSaving}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(project.id)}
                          className="btn-danger btn-small"
                          disabled={isSaving}
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem', marginLeft: '2rem' }}>
                  {project.dataInizio || '—'} a {project.dataFine || '—'}
                  {' • '}Fasi: {summary.completed}/{summary.total} completate
                  {summary.delayed > 0 && ` • ${summary.delayed} in ritardo`}
                </div>

                {isExpanded && Array.isArray(project.fasi) && project.fasi.length > 0 && (
                  <div style={{ marginTop: '0.5rem', marginLeft: '2rem', borderTop: '1px solid #334155', paddingTop: '0.5rem' }}>
                    {project.fasi.map((fase) => (
                      <div
                        key={fase.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          padding: '0.25rem 0',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              backgroundColor: fase.colore || project.colore || '#3b82f6',
                              borderRadius: '2px',
                              display: 'inline-block'
                            }}
                          />
                          <span>{fase.nome}</span>
                          {fase.milestone && <span title="Milestone">◆</span>}
                          <span className={`badge badge--${fase.stato}`} style={{ fontSize: '0.7rem' }}>
                            {AppConfig.stateLabels[fase.stato] || fase.stato}
                          </span>
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                          {fase.dataInizio || '—'} - {fase.dataFine || '—'}
                          {fase.percentualeCompletamento !== null && ` (${fase.percentualeCompletamento}%)`}
                        </div>
                      </div>
                    ))}
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

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.ProjectList = ProjectList;
}

export default ProjectList;
