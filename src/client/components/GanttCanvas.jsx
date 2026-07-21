import gantt from '../../domain/ganttCalculator.js';
import dateUtils from '../../utils/dateUtils.js';
import AppConfig from '../../app-config.js';

const { useRef, useEffect, useState, useCallback } = React;

export function GanttCanvas({
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
  sidebarCollapsed,
  onIsScrollableChange
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const viewportRef = useRef(null);
  const topScrollbarRef = useRef(null);
  const bottomScrollbarRef = useRef(null);
  const verticalScrollContainerRef = useRef(null);
  const syncedVerticalScrollTopRef = useRef(0);
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
  const handledScrollToTodayTriggerRef = useRef(0);
  const isSyncingVerticalScrollRef = useRef(false);

  useEffect(() => {
    if (verticalScrollContainerRef.current && verticalScrollTop !== undefined) {
      if (Math.abs(verticalScrollContainerRef.current.scrollTop - verticalScrollTop) > 0.5) {
        isSyncingVerticalScrollRef.current = true;
        verticalScrollContainerRef.current.scrollTop = verticalScrollTop;
        requestAnimationFrame(() => {
          isSyncingVerticalScrollRef.current = false;
        });
      }
    }
  }, [verticalScrollTop]);

  const currentVerticalScrollTop = verticalScrollTop || 0;

  const handleVerticalScroll = useCallback((e) => {
    if (isSyncingVerticalScrollRef.current) return;
    if (onVerticalScrollChange) {
      onVerticalScrollChange(e.target.scrollTop);
    }
  }, [onVerticalScrollChange]);

  const handleVerticalWheel = useCallback((e) => {
    const container = verticalScrollContainerRef.current;
    if (!container || !onVerticalScrollChange || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScrollTop <= 0) return;

    const nextScrollTop = Math.min(
      Math.max(0, container.scrollTop + e.deltaY),
      maxScrollTop
    );

    if (Math.abs(nextScrollTop - container.scrollTop) <= 0.5) return;

    e.preventDefault();
    syncedVerticalScrollTopRef.current = nextScrollTop;
    container.scrollTop = nextScrollTop;
    onVerticalScrollChange(nextScrollTop);
  }, [onVerticalScrollChange]);

  useEffect(() => {
    const container = verticalScrollContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleVerticalWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleVerticalWheel);
    };
  }, [handleVerticalWheel]);

  const updateScrollbars = useCallback((newLayout) => {
    const viewport = viewportRef.current;
    if (!viewport || !newLayout) return;

    const containerWidth = viewport.clientWidth;
    const contentWidth = newLayout.canvasWidth;
    scrollbarWidthRef.current = contentWidth;

    [topScrollbarRef, bottomScrollbarRef].forEach(ref => {
      if (ref.current) {
        const contentEl = ref.current.querySelector('.gantt-scrollbar-content');
        if (contentEl) {
          contentEl.style.width = `${contentWidth}px`;
        }
      }
    });

    const maxScroll = Math.max(0, contentWidth - containerWidth);
    const validScrollLeft = Math.min(scrollLeftRef.current, maxScroll);

    [topScrollbarRef, bottomScrollbarRef, viewportRef].forEach(ref => {
      if (ref.current && Math.abs(ref.current.scrollLeft - validScrollLeft) > 1) {
        ref.current.scrollLeft = validScrollLeft;
      }
    });

    scrollLeftRef.current = validScrollLeft;
    setScrollLeft(validScrollLeft);
  }, []);

  const updateLayout = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const containerWidth = viewport.clientWidth;
    const newLayout = gantt.getLayout(viewMode, projects, containerWidth, filters);
    setLayout(newLayout);
    updateScrollbars(newLayout);
  }, [viewMode, projects, filters, updateScrollbars]);

  useEffect(() => {
    updateLayout();
  }, [updateLayout, refreshTrigger]);

  useEffect(() => {
    const handleResize = () => {
      gantt.invalidateCache();
      updateLayout();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLayout]);

  useEffect(() => {
    if (sidebarCollapsed !== undefined) {
      gantt.invalidateCache();
      const timer = setTimeout(() => {
        updateLayout();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sidebarCollapsed, updateLayout]);

  const scrollToDate = useCallback((dateStr) => {
    if (!layout || !viewportRef.current) return;

    const dateX = layout.dateToX[dateStr];
    if (dateX !== null && dateX !== undefined) {
      const containerWidth = viewportRef.current.clientWidth;
      const targetScrollLeft = Math.max(0, dateX - containerWidth / 2);

      [topScrollbarRef, bottomScrollbarRef, viewportRef].forEach(ref => {
        if (ref.current) {
          ref.current.scrollLeft = targetScrollLeft;
        }
      });

      scrollLeftRef.current = targetScrollLeft;
      setScrollLeft(targetScrollLeft);
    }
  }, [layout]);

  const scrollToToday = useCallback(() => {
    const todayStr = dateUtils.formatDate(new Date());
    scrollToDate(todayStr);
  }, [scrollToDate]);

  useEffect(() => {
    if (scrollToTodayTrigger && scrollToTodayTrigger !== handledScrollToTodayTriggerRef.current) {
      handledScrollToTodayTriggerRef.current = scrollToTodayTrigger;
      scrollToToday();
    }
  }, [scrollToTodayTrigger, scrollToToday]);

  useEffect(() => {
    if (lastViewModeRef.current !== viewMode) {
      scrollPositionsRef.current[lastViewModeRef.current] = scrollLeft;
      const savedScroll = scrollPositionsRef.current[viewMode];
      if (savedScroll !== undefined) {
        setTimeout(() => {
          [topScrollbarRef, bottomScrollbarRef, viewportRef].forEach(ref => {
            if (ref.current) {
              ref.current.scrollLeft = savedScroll;
            }
          });
          scrollLeftRef.current = savedScroll;
          setScrollLeft(savedScroll);
        }, 0);
      } else {
        setTimeout(scrollToToday, 0);
      }
      lastViewModeRef.current = viewMode;
    }
  }, [viewMode, scrollLeft, scrollToToday]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport || !layout) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = layout.canvasWidth * dpr;
    canvas.height = layout.canvasHeight * dpr;
    canvas.style.width = `${layout.canvasWidth}px`;
    canvas.style.height = `${layout.canvasHeight}px`;

    ctx.scale(dpr, dpr);

    const renderViewport = {
      top: currentVerticalScrollTop,
      bottom: currentVerticalScrollTop + viewport.clientHeight
    };

    gantt.render(ctx, layout, {
      hoveredProjectId,
      viewport: renderViewport
    });
  }, [layout, scrollLeft, hoveredProjectId, currentVerticalScrollTop]);

  const syncScrollLeft = (newScrollLeft) => {
    pendingScrollLeftRef.current = newScrollLeft;

    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      const targetScroll = pendingScrollLeftRef.current;
      scrollLeftRef.current = targetScroll;

      [topScrollbarRef, bottomScrollbarRef, viewportRef].forEach(ref => {
        if (ref.current && Math.abs(ref.current.scrollLeft - targetScroll) > 1) {
          ref.current.scrollLeft = targetScroll;
        }
      });

      setScrollLeft(targetScroll);
      scrollRafRef.current = null;
    });
  };

  const handleScrollbarScroll = (e) => {
    syncScrollLeft(e.target.scrollLeft);
  };

  const handleViewportScroll = (e) => {
    syncScrollLeft(e.target.scrollLeft);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const result = gantt.hitTest(mouseX, mouseY, layout);

    if (result) {
      if (result.type === 'phase') {
        const fase = result.phase;
        const project = result.project;
        let text = `${project.nome}: ${fase.nome}`;
        if (fase.dataInizio && fase.dataFine) {
          text += ` (${fase.dataInizio} - ${fase.dataFine})`;
        } else if (fase.dataFine) {
          text += ` (${fase.dataFine})`;
        }
        if (fase.percentualeCompletamento !== null) {
          text += ` - ${fase.percentualeCompletamento}%`;
        }
        if (fase.note) {
          text += `\nNote: ${fase.note}`;
        }
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text
        });

        if (onProjectHover && project.id !== hoveredProjectId) {
          onProjectHover(project.id);
        }
      } else if (result.type === 'project') {
        const project = result.project;
        let text = project.nome;
        if (project.dataInizio && project.dataFine) {
          text += ` (${project.dataInizio} - ${project.dataFine})`;
        }
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text
        });

        if (onProjectHover && project.id !== hoveredProjectId) {
          onProjectHover(project.id);
        }
      } else {
        setTooltip(null);
        if (onProjectHover && hoveredProjectId !== null) {
          onProjectHover(null);
        }
      }
    } else {
      setTooltip(null);
      if (onProjectHover && hoveredProjectId !== null) {
        onProjectHover(null);
      }
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
    if (onProjectHover && hoveredProjectId !== null) {
      onProjectHover(null);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const result = gantt.hitTest(mouseX, mouseY, layout);

    if (result && (result.type === 'phase' || result.type === 'project')) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        phase: result.phase,
        project: result.project
      });
    } else {
      setContextMenu(null);
    }
  };

  const handleMenuAction = () => {
    if (contextMenu && contextMenu.project) {
      const projectRow = layout?.rows.find(r => r.project.id === contextMenu.project.id);
      if (projectRow && verticalScrollContainerRef.current) {
        verticalScrollContainerRef.current.scrollTop = projectRow.y - AppConfig.gantt.CANVAS_TOP_MARGIN;
      }
    }
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenu && !e.target.closest('.gantt-context-menu')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    if (!layout || scrollLeft <= AppConfig.gantt.CANVAS_LEFT_MARGIN) {
      setScrollLabels([]);
      return;
    }

    const labels = [];
    const minVisibleY = currentVerticalScrollTop;
    const maxVisibleY = currentVerticalScrollTop + (viewportRef.current?.clientHeight || 800);

    layout.rows.forEach(row => {
      const rowTop = row.y;
      const rowBottom = row.y + row.height;

      if (rowBottom >= minVisibleY && rowTop <= maxVisibleY) {
        const project = row.project;
        if (project.dataInizio && project.dataFine) {
          const x1 = layout.dateToX[project.dataInizio];
          const x2 = layout.dateToX[project.dataFine];

          if (x1 !== null && x2 !== null) {
            const barWidth = x2 - x1 + layout.pixelsPerDay;
            const barRight = x1 + barWidth;

            if (scrollLeft > x1 && scrollLeft < barRight) {
              labels.push({
                text: project.nome,
                y: row.y + 4,
                height: row.height - 8,
                color: project.colore || '#3b82f6'
              });
            }
          }
        }
      }
    });

    setScrollLabels(labels);
  }, [layout, scrollLeft, currentVerticalScrollTop]);

  const isScrollable = layout && layout.canvasWidth > (viewportRef.current?.clientWidth || 0);

  useEffect(() => {
    if (onIsScrollableChange) {
      onIsScrollableChange(Boolean(isScrollable));
    }
  }, [isScrollable, onIsScrollableChange]);

  return (
    <div className="gantt-canvas-container">
      {isScrollable && (
        <div ref={topScrollbarRef} className="gantt-scrollbar" onScroll={handleScrollbarScroll}>
          <div className="gantt-scrollbar-content"></div>
        </div>
      )}

      <div ref={wrapperRef} className="gantt-canvas-wrapper">
        <div
          ref={viewportRef}
          className="gantt-viewport"
          onScroll={handleViewportScroll}
        >
          <div
            ref={verticalScrollContainerRef}
            className="gantt-vertical-scroll-container"
            onScroll={handleVerticalScroll}
            style={{
              height: layout ? `${layout.canvasHeight}px` : 'auto',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
          >
            <canvas
              ref={canvasRef}
              className="gantt-canvas"
              role="img"
              aria-label="Diagramma Gantt dei progetti visibili"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>

        {scrollLabels.map((label, i) => (
          <div
            key={i}
            className="gantt-scroll-label"
            style={{
              top: `${label.y}px`,
              transform: `translateY(-${currentVerticalScrollTop}px)`,
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
      </div>

      {isScrollable && (
        <div ref={bottomScrollbarRef} className="gantt-scrollbar" onScroll={handleScrollbarScroll}>
          <div className="gantt-scrollbar-content"></div>
        </div>
      )}

      {tooltip && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal ? (
        ReactDOM.createPortal(
          <div
            className="gantt-tooltip"
            style={{
              position: 'fixed',
              left: `${Math.min(tooltip.x + 12, window.innerWidth - 320)}px`,
              top: `${Math.min(tooltip.y + 12, window.innerHeight - 100)}px`,
              pointerEvents: 'none',
              zIndex: 9999
            }}
            role="tooltip"
          >
            {tooltip.text.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>,
          document.body
        )
      ) : (
        tooltip && (
          <div
            className="gantt-tooltip"
            style={{
              position: 'fixed',
              left: `${Math.min(tooltip.x + 12, window.innerWidth - 320)}px`,
              top: `${Math.min(tooltip.y + 12, window.innerHeight - 100)}px`,
              pointerEvents: 'none',
              zIndex: 9999
            }}
            role="tooltip"
          >
            {tooltip.text.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )
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

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.GanttCanvas = GanttCanvas;
}

export default GanttCanvas;
