(function() {
  'use strict';

  const { useState, useEffect, useCallback, useRef } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const config = window.AppConfig;
  const logic = window.OnlyGantt.logic;

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

    const scrollContainerRef = useRef(null);
    const syncedScrollTopRef = useRef(null);
    const headerHeight = ganttHeaderHeight || config.gantt.CANVAS_TOP_MARGIN;
    const rowHeight = config.gantt.ROW_HEIGHT;
    const hasTopScrollbar = viewMode === '4months';
    const scrollbarOffset = hasTopScrollbar ? SCROLLBAR_HEIGHT : 0;
    const headerSpacerHeight = headerHeight - 36 + scrollbarOffset;
    const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
    const projectsHeight = projects.length * rowHeight;
    const bottomSpacerHeight = config.gantt.CANVAS_BOTTOM_MARGIN + scrollbarOffset;
    const scrollContentHeight = headerSpacerHeight + projectsHeight + bottomSpacerHeight;

    const getMaxScrollTop = useCallback(() => {
      const containerHeight = scrollContainerRef.current ? scrollContainerRef.current.clientHeight : 0;
      return Math.max(0, scrollContentHeight - containerHeight);
    }, [scrollContentHeight]);

    const clampScrollTop = useCallback((value) => {
      const maxScrollTop = getMaxScrollTop();
      return Math.min(Math.max(0, value), maxScrollTop);
    }, [getMaxScrollTop]);

    const handleScroll = useCallback((e) => {
      const nextScrollTop = clampScrollTop(e.currentTarget.scrollTop);
      const syncedScrollTop = syncedScrollTopRef.current;

      if (syncedScrollTop !== null && Math.abs(nextScrollTop - syncedScrollTop) <= 0.5) {
        syncedScrollTopRef.current = null;
        return;
      }

      syncedScrollTopRef.current = null;
      if (onScrollChange && Math.abs(nextScrollTop - (scrollTop || 0)) > 0.5) {
        onScrollChange(nextScrollTop);
      }
    }, [clampScrollTop, onScrollChange, scrollTop]);

    const handleWheel = useCallback((e) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer || !onScrollChange || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

      const nextScrollTop = clampScrollTop(scrollContainer.scrollTop + e.deltaY);
      if (Math.abs(nextScrollTop - scrollContainer.scrollTop) <= 0.5) return;

      e.preventDefault();
      syncedScrollTopRef.current = nextScrollTop;
      scrollContainer.scrollTop = nextScrollTop;
      onScrollChange(nextScrollTop);
    }, [clampScrollTop, onScrollChange]);

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        scrollContainer.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const clampedScrollTop = clampScrollTop(scrollTop || 0);
      if (Math.abs(scrollContainer.scrollTop - clampedScrollTop) > 0.5) {
        syncedScrollTopRef.current = clampedScrollTop;
        scrollContainer.scrollTop = clampedScrollTop;
      }
    }, [clampScrollTop, scrollTop]);

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(isCollapsed));
      } catch {}

      if (onCollapsedChange) {
        onCollapsedChange(isCollapsed);
      }
    }, [isCollapsed, onCollapsedChange]);

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
        className={`project-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
        style={{ width: sidebarWidth }}
      >
        <div className="sidebar-header">
          <button
            className="sidebar-btn sidebar-toggle-btn"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Espandi lista progetti' : 'Comprimi lista progetti'}
            aria-label={isCollapsed ? 'Espandi lista progetti' : 'Comprimi lista progetti'}
          >
            <span className="sidebar-icon">
              {isCollapsed ? '☰' : '✕'}
            </span>
          </button>

          {!isCollapsed && (
            <div className="sidebar-title">
              Progetti
              <span className="sidebar-count">{projects.length}</span>
            </div>
          )}

          {isCollapsed && (
            <span className="sidebar-count compact">{projects.length}</span>
          )}
        </div>

        <div
          className="sidebar-scroll-container"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <div
            className="sidebar-projects"
            style={{
              height: scrollContentHeight
            }}
          >
            <div
              className="sidebar-header-spacer"
              style={{ height: headerSpacerHeight }}
            />

            {projects.length === 0 ? (
              !isCollapsed && (
                <div className="sidebar-empty">
                  Nessun progetto
                </div>
              )
            ) : (
              projects.map((project) => {
                const isSelected = selectedProjectIds.has(project.id);
                const isHovered = hoveredProjectId === project.id;
                const alerts = logic.getProjectAlerts(project);
                const severity = logic.getProjectAlertSeverity(alerts);
                const percentage = logic.calculateProjectPercentage(project);
                const abbreviation = getProjectAbbreviation(project.nome);

                return (
                  <div
                    key={project.id}
                    className={`sidebar-project-row ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} severity-${severity || 'none'}`}
                    style={{ height: rowHeight }}
                    onMouseEnter={() => onProjectHover && onProjectHover(project.id)}
                    onMouseLeave={() => onProjectHover && onProjectHover(null)}
                  >
                    {isCollapsed ? (
                      <button
                        type="button"
                        className="sidebar-project-collapsed"
                        onClick={() => toggleProjectInGantt(project.id)}
                        title={`${project.nome} - ${percentage}%`}
                        aria-label={`${project.nome} - ${percentage}%`}
                      >
                        <span
                          className="sidebar-project-acronym"
                          style={{ backgroundColor: project.colore || '#64748b' }}
                        >
                          {abbreviation}
                        </span>
                        <span className="sidebar-project-mini-percent">{percentage}%</span>
                        {isSelected && <span className="sidebar-check-indicator">✓</span>}
                      </button>
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
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  ProjectSidebar.SIDEBAR_WIDTH_EXPANDED = SIDEBAR_WIDTH_EXPANDED;
  ProjectSidebar.SIDEBAR_WIDTH_COLLAPSED = SIDEBAR_WIDTH_COLLAPSED;

  window.OnlyGantt.components.ProjectSidebar = ProjectSidebar;
})();
