import logic from '../../domain/projectLogic.js';
import AppConfig from '../../app-config.js';

const { useState, useEffect, useCallback, useRef } = React;

const STORAGE_KEY_COLLAPSED = 'onlygantt_sidebar_collapsed';
const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SCROLLBAR_HEIGHT = 20;

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
  readOnly,
  isSaving,
  hoveredProjectId,
  onProjectHover,
  onSelectProject,
  verticalScrollTop,
  onVerticalScrollChange,
  onCollapsedChange
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  const scrollContainerRef = useRef(null);

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
    if (onVerticalScrollChange) {
      onVerticalScrollChange(e.target.scrollTop);
    }
  }, [onVerticalScrollChange]);

  useEffect(() => {
    if (scrollContainerRef.current && verticalScrollTop !== undefined) {
      if (Math.abs(scrollContainerRef.current.scrollTop - verticalScrollTop) > 0.5) {
        scrollContainerRef.current.scrollTop = verticalScrollTop;
      }
    }
  }, [verticalScrollTop]);

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

  const currentWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <aside
      className={`project-sidebar ${collapsed ? 'project-sidebar--collapsed' : ''}`}
      style={{
        width: `${currentWidth}px`,
        flexShrink: 0
      }}
    >
      <div className="project-sidebar__header">
        {!collapsed && (
          <div className="project-sidebar__title-area">
            <h3 className="project-sidebar__title">Progetti ({projects.length})</h3>
            {projects.length > 0 && (
              <label className="checkbox-label" style={{ fontSize: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={selectedProjectIds.size === projects.length && projects.length > 0}
                  onChange={toggleSelectAll}
                />
                Tutti
              </label>
            )}
          </div>
        )}
        <button
          type="button"
          className="project-sidebar__toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <div className="project-sidebar__spacer-top" style={{ height: `${AppConfig.gantt.CANVAS_TOP_MARGIN}px` }} />

      <div
        ref={scrollContainerRef}
        className="project-sidebar__scroll-area"
        onScroll={handleScroll}
        style={{
          maxHeight: '70vh',
          overflowY: 'auto'
        }}
      >
        {projects.length === 0 ? (
          <div className="project-sidebar__empty">
            {collapsed ? '—' : 'Nessun progetto'}
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = selectedProjectIds.has(project.id);
            const isHovered = hoveredProjectId === project.id;
            const percentage = logic.calculateProjectPercentage(project);
            const alerts = logic.getProjectAlerts(project);
            const severity = logic.getProjectAlertSeverity(alerts);

            return (
              <div
                key={project.id}
                className={`project-sidebar__item ${isHovered ? 'project-sidebar__item--hovered' : ''}`}
                style={{
                  height: `${AppConfig.gantt.ROW_HEIGHT}px`,
                  borderLeft: `4px solid ${project.colore || '#3b82f6'}`
                }}
                onMouseEnter={() => onProjectHover && onProjectHover(project.id)}
                onMouseLeave={() => onProjectHover && onProjectHover(null)}
                onClick={() => onSelectProject && onSelectProject(project.id)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelectProject(project.id);
                  }}
                  aria-label={`Seleziona ${project.nome}`}
                  className="project-sidebar__checkbox"
                />

                {collapsed ? (
                  <div className="project-sidebar__collapsed-info" title={`${project.nome} (${percentage}%)`}>
                    <span className="project-sidebar__abbr">
                      {getProjectAbbreviation(project.nome)}
                    </span>
                    {severity && (
                      <span className={`alert-badge alert-badge--${severity} alert-badge--tiny`}>
                        ⚠
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="project-sidebar__expanded-info">
                    <span className="project-sidebar__name" title={project.nome}>
                      {project.nome}
                    </span>

                    {severity && (
                      <span className={`alert-badge alert-badge--${severity} alert-badge--tiny`}>
                        ⚠
                      </span>
                    )}

                    <span className="project-sidebar__percentage">
                      {percentage}%
                    </span>

                    {!readOnly && (
                      <div className="project-sidebar__actions">
                        <button
                          type="button"
                          className="btn-icon-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(project);
                          }}
                          title="Modifica progetto"
                        >
                          ✏
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="project-sidebar__spacer-bottom" style={{ height: `${AppConfig.gantt.CANVAS_BOTTOM_MARGIN + SCROLLBAR_HEIGHT}px` }} />
    </aside>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.ProjectSidebar = ProjectSidebar;
}

export default ProjectSidebar;
