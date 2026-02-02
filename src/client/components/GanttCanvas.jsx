(function() {
  'use strict';

  const { useRef, useEffect, useState, useCallback } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const gantt = window.OnlyGantt.gantt;
  const dateUtils = window.OnlyGantt.dateUtils;
  const config = window.AppConfig;

  function GanttCanvas({
    viewMode,
    projects,
    filters,
    scrollToTodayTrigger,
    refreshTrigger,
    onPhaseContextMenu,
    hoveredProjectId,
    onProjectHover,
    verticalScrollTop,
    onVerticalScrollChange,
    sidebarCollapsed
  }) {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const topScrollbarRef = useRef(null);
    const bottomScrollbarRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [layout, setLayout] = useState(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [contextMenu, setContextMenu] = useState(null);
    const [scrollLabels, setScrollLabels] = useState([]);
    const scrollPositionsRef = useRef({});
    const lastViewModeRef = useRef(viewMode);
    const scrollLeftRef = useRef(0);
    const scrollbarWidthRef = useRef(0);
    const scrollRafRef = useRef(null);
    const pendingScrollLeftRef = useRef(0);
    const verticalScrollContainerRef = useRef(null);
    const isVerticalScrollingRef = useRef(false);

    useEffect(() => {
      if (verticalScrollContainerRef.current && !isVerticalScrollingRef.current && verticalScrollTop !== undefined) {
        verticalScrollContainerRef.current.scrollTop = verticalScrollTop;
      }
    }, [verticalScrollTop]);

    const scrollTimeoutRef = useRef(null);

    const handleVerticalScroll = useCallback((e) => {
      isVerticalScrollingRef.current = true;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (onVerticalScrollChange) {
        onVerticalScrollChange(e.target.scrollTop);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        isVerticalScrollingRef.current = false;
      }, 50);
    }, [onVerticalScrollChange]);

    useEffect(() => () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }, []);

    const updateScrollbars = useCallback((newLayout) => {
      if (!topScrollbarRef.current || !bottomScrollbarRef.current || viewMode !== '4months') {
        return;
      }

      const containerWidth = wrapperRef.current ? wrapperRef.current.clientWidth : 0;
      const scrollbarWidth = Math.max(newLayout.canvasWidth, containerWidth);
      if (scrollbarWidthRef.current !== scrollbarWidth) {
        const ensureScrollbarContent = (scrollbar) => {
          let content = scrollbar.querySelector('.gantt-scrollbar-content');
          if (!content) {
            content = document.createElement('div');
            content.className = 'gantt-scrollbar-content';
            scrollbar.innerHTML = '';
            scrollbar.appendChild(content);
          }
          return content;
        };

        const topContent = ensureScrollbarContent(topScrollbarRef.current);
        const bottomContent = ensureScrollbarContent(bottomScrollbarRef.current);
        topContent.style.width = `${scrollbarWidth}px`;
        topContent.style.height = '1px';
        bottomContent.style.width = `${scrollbarWidth}px`;
        bottomContent.style.height = '1px';
        scrollbarWidthRef.current = scrollbarWidth;
      }

      const currentScroll = scrollLeftRef.current;
      topScrollbarRef.current.scrollLeft = currentScroll;
      bottomScrollbarRef.current.scrollLeft = currentScroll;
    }, [viewMode]);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      const verticalContainer = verticalScrollContainerRef.current;
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      const containerWidth = wrapper.clientWidth;

      const newLayout = gantt.getLayout(viewMode, projects, containerWidth, filters);
      setLayout(newLayout);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = newLayout.canvasWidth * dpr;
      canvas.height = newLayout.canvasHeight * dpr;
      canvas.style.width = `${newLayout.canvasWidth}px`;
      canvas.style.height = `${newLayout.canvasHeight}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const viewport = verticalContainer ? {
        top: verticalContainer.scrollTop,
        bottom: verticalContainer.scrollTop + verticalContainer.clientHeight
      } : null;

      const hideProjectLabels = sidebarCollapsed === false;
      gantt.render(ctx, newLayout, { hoveredProjectId, hideProjectLabels, viewport });

      updateScrollbars(newLayout);
    }, [viewMode, projects, filters, updateScrollbars, sidebarCollapsed, hoveredProjectId]);

    const prevHoveredProjectIdRef = useRef(null);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const verticalContainer = verticalScrollContainerRef.current;
      if (!canvas || !layout) return;

      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const viewport = verticalContainer ? {
        top: verticalContainer.scrollTop,
        bottom: verticalContainer.scrollTop + verticalContainer.clientHeight
      } : null;

      const hideProjectLabels = sidebarCollapsed === false;
      gantt.render(ctx, layout, { hoveredProjectId, hideProjectLabels, viewport });
      prevHoveredProjectIdRef.current = hoveredProjectId;
    }, [layout, hoveredProjectId, sidebarCollapsed]);

    const initialRenderDoneRef = useRef(false);
    const prevSidebarCollapsedRef = useRef(sidebarCollapsed);

    useEffect(() => {
      redraw();
    }, [hoveredProjectId]);

    useEffect(() => {
      const frame = requestAnimationFrame(() => {
        gantt.invalidateCache();
        render();
        initialRenderDoneRef.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }, [projects, viewMode, filters]);

    useEffect(() => {
      if (refreshTrigger === 0) return;
      gantt.invalidateCache();
      render();
    }, [refreshTrigger]);

    useEffect(() => {
      if (prevSidebarCollapsedRef.current === sidebarCollapsed && !initialRenderDoneRef.current) {
        prevSidebarCollapsedRef.current = sidebarCollapsed;
        return;
      }
      prevSidebarCollapsedRef.current = sidebarCollapsed;

      const timeout = setTimeout(() => {
        gantt.invalidateCache();
        render();
      }, 220);
      return () => clearTimeout(timeout);
    }, [sidebarCollapsed]);

    useEffect(() => {
      scrollLeftRef.current = scrollLeft;
    }, [scrollLeft]);

    useEffect(() => {
      const previousViewMode = lastViewModeRef.current;
      if (previousViewMode && previousViewMode !== viewMode) {
        scrollPositionsRef.current[previousViewMode] = scrollLeftRef.current;
      }

      lastViewModeRef.current = viewMode;
      setTooltip(null);
    }, [viewMode]);

    const restoreScrollPosition = useCallback((targetScroll) => {
      if (!layout || !wrapperRef.current) return;

      const maxScroll = Math.max(0, layout.canvasWidth - wrapperRef.current.clientWidth);
      const clampedScroll = Math.min(targetScroll, maxScroll);

      if (topScrollbarRef.current) {
        topScrollbarRef.current.scrollLeft = clampedScroll;
      }
      if (bottomScrollbarRef.current) {
        bottomScrollbarRef.current.scrollLeft = clampedScroll;
      }
      setScrollLeft(clampedScroll);
    }, [layout]);

    useEffect(() => {
      if (viewMode !== '4months') {
        setScrollLeft(0);
        scrollbarWidthRef.current = 0;
        return;
      }
      if (!layout) return;
      const savedScroll = scrollPositionsRef.current[viewMode] || 0;
      if (savedScroll > 0) {
        restoreScrollPosition(savedScroll);
      }
    }, [viewMode, restoreScrollPosition]);

    useEffect(() => {
      if (viewMode !== '4months' || !layout) return;
      const frame = window.requestAnimationFrame(() => {
        updateScrollbars(layout);
      });
      return () => window.cancelAnimationFrame(frame);
    }, [viewMode, layout, updateScrollbars]);

    useEffect(() => {
      const handleResize = () => {
        gantt.invalidateCache();
        render();
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [render]);

    useEffect(() => {
      if (scrollToTodayTrigger && layout && topScrollbarRef.current) {
        const today = new Date();
        const todayStr = dateUtils.formatDate(today);
        const todayX = layout.dateToX[todayStr];

        if (todayX !== null && todayX !== undefined && wrapperRef.current) {
          const wrapperWidth = wrapperRef.current.clientWidth;
          const scrollPos = Math.max(0, todayX - wrapperWidth / 2);

          topScrollbarRef.current.scrollLeft = scrollPos;
          bottomScrollbarRef.current.scrollLeft = scrollPos;
          setScrollLeft(scrollPos);
        }
      }
    }, [scrollToTodayTrigger, layout]);

    useEffect(() => {
      if (!layout || !wrapperRef.current) return;

      const maxScroll = Math.max(0, layout.canvasWidth - wrapperRef.current.clientWidth);
      const clampedScroll = Math.min(scrollLeft, maxScroll);

      if (topScrollbarRef.current) {
        topScrollbarRef.current.scrollLeft = clampedScroll;
      }
      if (bottomScrollbarRef.current) {
        bottomScrollbarRef.current.scrollLeft = clampedScroll;
      }
      if (clampedScroll !== scrollLeft) {
        setScrollLeft(clampedScroll);
      }
    }, [layout, scrollLeft]);

    useEffect(() => {
      if (!layout) return;
      updateScrollbars(layout);
    }, [layout, updateScrollbars]);

    const updateScrollLabels = useCallback(() => {
      if (!layout || !wrapperRef.current || viewMode !== '4months') {
        setScrollLabels([]);
        return;
      }

      const containerWidth = wrapperRef.current.clientWidth;
      const viewportLeft = scrollLeftRef.current;
      const viewportRight = viewportLeft + containerWidth;
      const labels = [];

      const topScrollbarHeight = topScrollbarRef.current ? topScrollbarRef.current.offsetHeight : 0;

      layout.rows.forEach(row => {
        const project = row.project;
        if (Array.isArray(project.fasi)) {
          project.fasi.forEach(fase => {
            if (!fase.milestone && fase.dataInizio && fase.dataFine && fase.nome) {
              const fx1 = layout.dateToX[fase.dataInizio];
              const fx2 = layout.dateToX[fase.dataFine];

              if (fx1 !== null && fx2 !== null) {
                const faseWidth = fx2 - fx1 + layout.pixelsPerDay;
                const faseRight = fx1 + faseWidth;

                if (fx1 < viewportLeft && faseRight > viewportLeft) {
                  const faseY = row.y + 4;
                  const faseHeight = row.height - 8;
                  const percentage = fase.percentualeCompletamento || 0;
                  const showPercent = filters.showPhasePercentages;
                  const labelText = showPercent ? `${fase.nome} ${percentage}%` : fase.nome;
                  labels.push({
                    text: labelText,
                    y: faseY + topScrollbarHeight,
                    height: faseHeight,
                    color: fase.colore || project.colore || '#3b82f6'
                  });
                }
              }
            }
          });
        }
      });

      setScrollLabels(labels);
    }, [layout, viewMode, filters.showPhasePercentages]);

    const handleScroll = useCallback((source) => {
      const left = source.scrollLeft;
      pendingScrollLeftRef.current = left;

      if (scrollRafRef.current === null) {
        scrollRafRef.current = window.requestAnimationFrame(() => {
          scrollRafRef.current = null;
          setScrollLeft(pendingScrollLeftRef.current);
          updateScrollLabels();
        });
      }

      if (source !== topScrollbarRef.current && topScrollbarRef.current) {
        topScrollbarRef.current.scrollLeft = left;
      }
      if (source !== bottomScrollbarRef.current && bottomScrollbarRef.current) {
        bottomScrollbarRef.current.scrollLeft = left;
      }
    }, [updateScrollLabels]);

    useEffect(() => {
      const topScrollbar = topScrollbarRef.current;
      const bottomScrollbar = bottomScrollbarRef.current;

      if (!topScrollbar || !bottomScrollbar) return;

      const handleTopScroll = () => handleScroll(topScrollbar);
      const handleBottomScroll = () => handleScroll(bottomScrollbar);

      topScrollbar.addEventListener('scroll', handleTopScroll);
      bottomScrollbar.addEventListener('scroll', handleBottomScroll);

      return () => {
        topScrollbar.removeEventListener('scroll', handleTopScroll);
        bottomScrollbar.removeEventListener('scroll', handleBottomScroll);
      };
    }, [handleScroll, viewMode]);

    useEffect(() => () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    }, []);

    useEffect(() => {
      updateScrollLabels();
    }, [layout, scrollLeft, viewMode, filters, updateScrollLabels]);

    const handleMouseMove = useCallback((e) => {
      if (!layout) {
        setTooltip(null);
        if (onProjectHover) onProjectHover(null);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = gantt.hitTest(mouseX, mouseY, layout);

      let hoveredProject = null;
      for (const row of layout.rows) {
        if (mouseY >= row.y && mouseY < row.y + row.height) {
          hoveredProject = row.project;
          break;
        }
      }
      if (onProjectHover) {
        onProjectHover(hoveredProject ? hoveredProject.id : null);
      }

      if (hit) {
        if (hit.type === 'phase') {
          const { phase, project } = hit;
          const percentage = phase.percentualeCompletamento || 0;
          const phaseLabel = phase.milestone ? 'Milestone' : 'Fase';
          const stateLabel = config.stateLabels?.[phase.stato] || phase.stato;
          const tooltipText = `${phaseLabel}: ${phase.nome || 'Senza nome'}\n${percentage}%\nProgetto: ${project.nome}\n${phase.dataInizio || '?'} - ${phase.dataFine || '?'}\nStato: ${stateLabel}`;

          setTooltip({
            x: e.clientX,
            y: e.clientY,
            text: tooltipText
          });
        } else if (hit.type === 'project') {
          const { project } = hit;
          const tooltipText = `${project.nome}\n${project.dataInizio || '?'} - ${project.dataFine || '?'}`;

          setTooltip({
            x: e.clientX,
            y: e.clientY,
            text: tooltipText
          });
        } else if (hit.type === 'date') {
          const date = dateUtils.parseDate(hit.date);
          const dateStr = date ? date.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : hit.date;
          const holidayName = date ? dateUtils.getHolidayName(date) : null;

          let tooltipText = dateStr;
          if (holidayName) {
            tooltipText += `\n${holidayName}`;
          }

          setTooltip({
            x: e.clientX,
            y: e.clientY,
            text: tooltipText
          });
        }
      } else {
        setTooltip(null);
      }
    }, [layout, onProjectHover]);

    const handleMouseLeave = useCallback(() => {
      setTooltip(null);
      if (onProjectHover) onProjectHover(null);
    }, [onProjectHover]);

    const handleContextMenu = useCallback((e) => {
      if (!layout) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const hit = gantt.hitTest(mouseX, mouseY, layout);

      if (hit && hit.type === 'phase') {
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          project: hit.project
        });
      } else if (contextMenu) {
        setContextMenu(null);
      }
    }, [layout, contextMenu]);

    const handleMenuAction = useCallback(() => {
      if (contextMenu?.project && onPhaseContextMenu) {
        onPhaseContextMenu(contextMenu.project);
      }
      setContextMenu(null);
    }, [contextMenu, onPhaseContextMenu]);

    useEffect(() => {
      if (!contextMenu) return;
      const handleClick = () => setContextMenu(null);
      const handleEscape = (event) => {
        if (event.key === 'Escape') {
          setContextMenu(null);
        }
      };
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', handleEscape);
      };
    }, [contextMenu]);

    const isScrollable = viewMode === '4months';

    return (
      <div className="gantt-canvas-wrapper">
        {isScrollable && (
          <div ref={topScrollbarRef} className="gantt-scrollbar">
            <div className="gantt-scrollbar-content"></div>
          </div>
        )}

        <div ref={wrapperRef} className="gantt-canvas-container-fixed">
          <div
            className="gantt-canvas-inner"
            style={{
              transform: `translateX(-${scrollLeft}px)`,
              willChange: 'transform'
            }}
          >
            <canvas
              ref={canvasRef}
              className="gantt-canvas"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>

        {isScrollable && (
          <div ref={bottomScrollbarRef} className="gantt-scrollbar">
            <div className="gantt-scrollbar-content"></div>
          </div>
        )}

        {scrollLabels.map((label, i) => (
          <div
            key={i}
            className="gantt-scroll-label"
            style={{
              top: `${label.y}px`,
              left: '24px',
              height: `${label.height}px`,
              backgroundColor: label.color,
              position: 'absolute',
              padding: '0 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              border: '1px solid rgba(30, 41, 59, 0.5)'
            }}
          >
            {label.text}
          </div>
        ))}

        {tooltip && (
          <div
            className="gantt-tooltip"
            style={{
              left: `${tooltip.x + 10}px`,
              top: `${tooltip.y + 10}px`
            }}
            role="tooltip"
          >
            {tooltip.text.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {contextMenu && (
          <div
            className="gantt-context-menu"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`
            }}
            role="menu"
          >
            <button type="button" onClick={handleMenuAction} role="menuitem">
              Vai su Progetto: {contextMenu.project?.nome || 'Senza nome'}
            </button>
          </div>
        )}
      </div>
    );
  }

  window.OnlyGantt.components.GanttCanvas = GanttCanvas;
})();
