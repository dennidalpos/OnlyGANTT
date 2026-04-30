(function() {
  'use strict';

  const { useState, useEffect, useCallback, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const config = window.AppConfig;
  const logic = window.OnlyGantt.logic;

  const STORAGE_KEY_COLLAPSED = 'onlygantt_sidebar_collapsed';
  const STORAGE_KEY_PINNED = 'onlygantt_sidebar_pinned';

  const SIDEBAR_WIDTH_EXPANDED = 260;
  const SIDEBAR_WIDTH_COLLAPSED = 40;

  const SCROLLBAR_HEIGHT = 20;

  function ProjectSidebar({
    projects,
    selectedProjectIds,
    onSelectedProjectIdsChange,
    onEditProject,
    onDeleteProject,
    readOnly,
    isSaving,
    hoveredProjectId,
    onProjectHover,
    scrollTop,
    onScrollChange,
    ganttHeaderHeight,
    onCollapsedChange,
    viewMode
  }) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_COLLAPSED);
        return saved === 'true';
      } catch {
        return false;
      }
    });

    const [isPinned, setIsPinned] = useState(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PINNED);
        return saved === 'true';
      } catch {
        return false;
      }
    });

    const scrollContainerRef = useRef(null);
    const headerHeight = ganttHeaderHeight || config.gantt.CANVAS_TOP_MARGIN;
    const rowHeight = config.gantt.ROW_HEIGHT;
    const hasTopScrollbar = viewMode === '4months';
    const scrollbarOffset = hasTopScrollbar ? SCROLLBAR_HEIGHT : 0;
    const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
    const projectsHeight = projects.length * rowHeight;
    const bottomSpacerHeight = config.gantt.CANVAS_BOTTOM_MARGIN + scrollbarOffset;
    const scrollContentHeight = projectsHeight + bottomSpacerHeight;

    const getMaxScrollTop = useCallback(() => {
      const containerHeight = scrollContainerRef.current ? scrollContainerRef.current.clientHeight : 0;
      return Math.max(0, scrollContentHeight - containerHeight);
    }, [scrollContentHeight]);

    const clampScrollTop = useCallback((value) => {
      const maxScrollTop = getMaxScrollTop();
      return Math.min(Math.max(0, value), maxScrollTop);
    }, [getMaxScrollTop]);

    const handleWheel = useCallback((e) => {
      if (!onScrollChange) return;

      const nextScrollTop = clampScrollTop((scrollTop || 0) + e.deltaY);

      if (nextScrollTop !== (scrollTop || 0)) {
        e.preventDefault();
        onScrollChange(nextScrollTop);
      }
    }, [clampScrollTop, onScrollChange, scrollTop]);

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        scrollContainer.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(isCollapsed));
      } catch {}

      if (onCollapsedChange) {
        onCollapsedChange(isCollapsed);
      }
    }, [isCollapsed, onCollapsedChange]);

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_PINNED, String(isPinned));
      } catch {}
    }, [isPinned]);

    useEffect(() => {
      if (!onScrollChange) return;

      const clampedScrollTop = clampScrollTop(scrollTop || 0);
      if (clampedScrollTop !== (scrollTop || 0)) {
        onScrollChange(clampedScrollTop);
      }
    }, [clampScrollTop, onScrollChange, scrollTop]);

    const toggleCollapsed = useCallback(() => {
      setIsCollapsed(prev => !prev);
    }, []);

    const togglePinned = useCallback(() => {
      setIsPinned(prev => !prev);
    }, []);

    const toggleProjectInGantt = useCallback((projectId) => {
      const newSelected = new Set(selectedProjectIds);
      if (newSelected.has(projectId)) {
        newSelected.delete(projectId);
      } else {
        newSelected.add(projectId);
      }
      onSelectedProjectIdsChange(newSelected);
    }, [selectedProjectIds, onSelectedProjectIdsChange]);

    return (
      <div
        className={`project-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${isPinned ? 'pinned' : ''}`}
        style={{ width: sidebarWidth }}
      >
        <div className="sidebar-header">
          <div className="sidebar-controls">
            <button
              className="sidebar-btn sidebar-toggle-btn"
              onClick={toggleCollapsed}
              title={isCollapsed ? 'Espandi sidebar' : 'Riduci sidebar'}
              aria-label={isCollapsed ? 'Espandi sidebar' : 'Riduci sidebar'}
            >
              <span className="sidebar-icon">
                {isCollapsed ? '☰' : '✕'}
              </span>
            </button>

            {!isCollapsed && (
              <button
                className={`sidebar-btn sidebar-pin-btn ${isPinned ? 'active' : ''}`}
                onClick={togglePinned}
                title={isPinned ? 'Sblocca sidebar' : 'Blocca sidebar aperta'}
                aria-label={isPinned ? 'Sblocca sidebar' : 'Blocca sidebar aperta'}
              >
                <span className="sidebar-icon">
                  {isPinned ? '📌' : '📍'}
                </span>
              </button>
            )}
          </div>

          {!isCollapsed && (
            <div className="sidebar-title">
              Progetti
              <span className="sidebar-count">{projects.length}</span>
            </div>
          )}
        </div>

        <div
          className="sidebar-header-spacer"
          style={{ height: headerHeight - 36 + scrollbarOffset }}
        />

        <div
          className="sidebar-scroll-container"
          ref={scrollContainerRef}
        >
          {projects.length === 0 ? (
            !isCollapsed && (
              <div className="sidebar-empty">
                Nessun progetto
              </div>
            )
          ) : (
            <div
              className="sidebar-projects"
              style={{
                transform: `translateY(-${scrollTop || 0}px)`,
                height: scrollContentHeight
              }}
            >
              {projects.map((project) => {
                const isSelected = selectedProjectIds.has(project.id);
                const isHovered = hoveredProjectId === project.id;
                const alerts = logic.getProjectAlerts(project);
                const severity = logic.getProjectAlertSeverity(alerts);

                return (
                  <div
                    key={project.id}
                    className={`sidebar-project-row ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} severity-${severity || 'none'}`}
                    style={{ height: rowHeight }}
                    onMouseEnter={() => onProjectHover && onProjectHover(project.id)}
                    onMouseLeave={() => onProjectHover && onProjectHover(null)}
                  >
                    {isCollapsed ? (
                      <div
                        className="sidebar-project-collapsed"
                        onClick={() => toggleProjectInGantt(project.id)}
                        title={project.nome}
                      >
                        <span
                          className="sidebar-project-color"
                          style={{ backgroundColor: project.colore || '#64748b' }}
                        />
                        {isSelected && <span className="sidebar-check-indicator">✓</span>}
                      </div>
                    ) : (
                      <div className="sidebar-project-expanded">
                        <label className="sidebar-project-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProjectInGantt(project.id)}
                          />
                        </label>

                        <span
                          className="sidebar-project-color"
                          style={{ backgroundColor: project.colore || '#64748b' }}
                        />

                        <div
                          className="sidebar-project-info"
                          onClick={() => !readOnly && onEditProject && onEditProject(project)}
                          title={readOnly ? project.nome : `Modifica: ${project.nome}`}
                        >
                          <span className="sidebar-project-name">
                            {project.nome}
                          </span>
                          <span className="sidebar-project-percent">
                            {logic.calculateProjectPercentage(project)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  ProjectSidebar.SIDEBAR_WIDTH_EXPANDED = SIDEBAR_WIDTH_EXPANDED;
  ProjectSidebar.SIDEBAR_WIDTH_COLLAPSED = SIDEBAR_WIDTH_COLLAPSED;

  window.OnlyGantt.components.ProjectSidebar = ProjectSidebar;
})();
