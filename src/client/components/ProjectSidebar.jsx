import logic from '../../domain/projectLogic.js';
import AppConfig from '../../app-config.js';

const { useState, useEffect, useCallback, useRef, useMemo } = React;

const STORAGE_KEY_COLLAPSED = 'onlygantt_sidebar_collapsed';
const SIDEBAR_HEADER_HEIGHT = 36;

function getProjectAbbreviation(projectName) {
  const words = String(projectName || '')
    .match(/[A-Za-z0-9]+/g) || [];

  if (words.length === 0) {
    return '--';
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words.slice(0, 3).map(word => word[0]).join('').toUpperCase();
}

export function ProjectSidebar({
  projects,
  selectedProjectIds,
  onSelectedProjectIdsChange,
  onEditProject,
  onDeleteProject,
  onNewProject,
  onImportJSON,
  onExportJSON,
  readOnly,
  isSaving,
  hoveredProjectId,
  onProjectHover,
  onSelectProject,
  verticalScrollTop,
  onVerticalScrollChange,
  onCollapsedChange,
  isScrollable
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(collapsed);
    }
  }, [collapsed, onCollapsedChange]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleScroll = useCallback((e) => {
    if (isSyncingScrollRef.current) return;
    const currentTop = e.target.scrollTop;

    const ganttContainer = document.querySelector('.gantt-vertical-scroll-container');
    if (ganttContainer && Math.abs(ganttContainer.scrollTop - currentTop) > 0.5) {
      ganttContainer.scrollTop = currentTop;
    }

    if (onVerticalScrollChange) {
      onVerticalScrollChange(currentTop);
    }
  }, [onVerticalScrollChange]);

  useEffect(() => {
    if (scrollContainerRef.current && verticalScrollTop !== undefined) {
      if (Math.abs(scrollContainerRef.current.scrollTop - verticalScrollTop) > 0.5) {
        isSyncingScrollRef.current = true;
        scrollContainerRef.current.scrollTop = verticalScrollTop;
        requestAnimationFrame(() => {
          isSyncingScrollRef.current = false;
        });
      }
    }
  }, [verticalScrollTop]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p => p.nome.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const toggleSelectAll = () => {
    const targetList = filteredProjects.length > 0 ? filteredProjects : projects;
    const allTargetSelected = targetList.every(p => selectedProjectIds.has(p.id));
    const next = new Set(selectedProjectIds);
    if (allTargetSelected) {
      targetList.forEach(p => next.delete(p.id));
    } else {
      targetList.forEach(p => next.add(p.id));
    }
    onSelectedProjectIdsChange(next);
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

  const topSpacerHeight = Math.max(0, AppConfig.gantt.CANVAS_TOP_MARGIN - SIDEBAR_HEADER_HEIGHT);

  const buildAlertTooltip = (alerts) => {
    if (!alerts) return '';
    const messages = [];
    if (alerts.projectDelayed) messages.push('• Progetto in ritardo (data fine superata)');
    if (alerts.phasesDelayed && alerts.phasesDelayed.length > 0) messages.push(`• ${alerts.phasesDelayed.length} fase/i in ritardo`);
    if (alerts.phasesOutsideRange && alerts.phasesOutsideRange.length > 0) messages.push(`• ${alerts.phasesOutsideRange.length} fase/i fuori dalle date del progetto`);
    if (alerts.milestonesOutsideRange && alerts.milestonesOutsideRange.length > 0) messages.push(`• ${alerts.milestonesOutsideRange.length} milestone fuori dalle date del progetto`);
    if (alerts.percentage100NotCompleted) messages.push('• Completamento al 100% ma stato non completato');
    if (alerts.projectMissingDates) messages.push('• Date di inizio/fine del progetto mancanti');
    if (alerts.noPhases) messages.push('• Nessuna fase definita per il progetto');
    if (alerts.phasesMissingDates && alerts.phasesMissingDates.length > 0) messages.push(`• ${alerts.phasesMissingDates.length} fase/i senza date`);
    if (alerts.phasesOnHoliday && alerts.phasesOnHoliday.length > 0) messages.push(`• ${alerts.phasesOnHoliday.length} fase/i su giorni festivi/weekend`);
    return messages.join('\n');
  };

  return (
    <aside className={`project-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="sidebar-header">
        {!collapsed ? (
          <>
            <div className="sidebar-title">
              Progetti <span className="sidebar-count">({projects.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {!readOnly && onNewProject && (
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={onNewProject}
                  title="Nuovo progetto"
                  disabled={isSaving}
                  style={{ width: '22px', height: '22px', fontSize: '0.75rem', background: 'var(--accent-primary)', color: '#fff', border: 'none' }}
                >
                  +
                </button>
              )}
              {projects.length > 0 && (
                <label className="checkbox-label" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && filteredProjects.every(p => selectedProjectIds.has(p.id))}
                    onChange={toggleSelectAll}
                  />
                  Tutti
                </label>
              )}
            </div>
          </>
        ) : (
          <span className="sidebar-count compact">{projects.length}</span>
        )}
        <button
          type="button"
          className="sidebar-btn"
          onClick={toggleCollapsed}
          title={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="sidebar-scroll-container"
        onScroll={handleScroll}
      >
        <div
          className="sidebar-header-spacer"
          style={{ height: `${topSpacerHeight}px` }}
        />

        <div className="sidebar-projects">
          {filteredProjects.length === 0 ? (
            <div className="sidebar-empty">
              {collapsed ? '—' : 'Nessun progetto'}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isSelected = selectedProjectIds.has(project.id);
              const isHovered = hoveredProjectId === project.id;
              const percentage = logic.calculateProjectPercentage(project);
              const alerts = logic.getProjectAlerts(project);
              const severity = logic.getProjectAlertSeverity(alerts);

              return (
                <div
                  key={project.id}
                  className={`sidebar-project-row ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${severity ? `severity-${severity}` : 'severity-none'}`}
                  style={{
                    height: `${AppConfig.gantt.ROW_HEIGHT}px`,
                    borderLeft: `4px solid ${project.colore || '#3b82f6'}`
                  }}
                  onMouseEnter={() => onProjectHover && onProjectHover(project.id)}
                  onMouseLeave={() => onProjectHover && onProjectHover(null)}
                >
                  {collapsed ? (
                    <button
                      type="button"
                      className="sidebar-project-collapsed"
                      onClick={() => onSelectProject && onSelectProject(project.id)}
                      title={`${project.nome} (${percentage}%)${severity ? '\n' + buildAlertTooltip(alerts) : ''}`}
                    >
                      <span
                        className="sidebar-project-acronym"
                        style={{ backgroundColor: project.colore || '#3b82f6' }}
                      >
                        {getProjectAbbreviation(project.nome)}
                      </span>
                      <span className="sidebar-project-mini-percent">{percentage}%</span>
                      {isSelected && <span className="sidebar-check-indicator">✓</span>}
                    </button>
                  ) : (
                    <div className="sidebar-project-expanded">
                      <div className="sidebar-project-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectProject(project.id);
                          }}
                          aria-label={`Seleziona ${project.nome}`}
                        />
                      </div>

                      <button
                        type="button"
                        className="sidebar-project-info"
                        onClick={() => onSelectProject && onSelectProject(project.id)}
                      >
                        <span className="sidebar-project-name" title={project.nome}>
                          {project.nome}
                        </span>

                        {severity && (
                          <span
                            className={`alert-badge alert-badge--${severity} alert-badge--tiny`}
                            title={buildAlertTooltip(alerts)}
                          >
                            ⚠
                          </span>
                        )}

                        <span className="sidebar-project-percent">{percentage}%</span>
                      </button>

                      {!readOnly && (
                        <button
                          type="button"
                          className="sidebar-btn sidebar-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(project);
                          }}
                          title="Modifica progetto"
                        >
                          ✏
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className="sidebar-header-spacer"
          style={{ height: `${AppConfig.gantt.CANVAS_BOTTOM_MARGIN}px` }}
        />
      </div>
    </aside>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.ProjectSidebar = ProjectSidebar;
}

export default ProjectSidebar;
