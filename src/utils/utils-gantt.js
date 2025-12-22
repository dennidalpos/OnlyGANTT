// Gantt canvas rendering utilities
// Exposed on window.OnlyGantt.gantt

(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const config = window.AppConfig;
  const dateUtils = window.OnlyGantt.dateUtils;
  const logic = window.OnlyGantt.logic;

  // Cache for layout calculations
  let layoutCache = null;

  /**
   * Invalidate layout cache
   */
  function invalidateCache() {
    layoutCache = null;
  }

  /**
   * Calculate timeline range based on view mode
   */
  function getProjectsDateRange(projects) {
    let minDate = null;
    let maxDate = null;

    projects.forEach(project => {
      if (project.dataInizio) {
        const d = dateUtils.parseDate(project.dataInizio);
        if (d && (!minDate || d < minDate)) minDate = d;
      }
      if (project.dataFine) {
        const d = dateUtils.parseDate(project.dataFine);
        if (d && (!maxDate || d > maxDate)) maxDate = d;
      }

      if (Array.isArray(project.fasi)) {
        project.fasi.forEach(fase => {
          if (fase.dataInizio) {
            const d = dateUtils.parseDate(fase.dataInizio);
            if (d && (!minDate || d < minDate)) minDate = d;
          }
          if (fase.dataFine) {
            const d = dateUtils.parseDate(fase.dataFine);
            if (d && (!maxDate || d > maxDate)) maxDate = d;
          }
        });
      }
    });

    return { minDate, maxDate };
  }

  function calculateTimelineRange(viewMode, projects) {
    const { minDate, maxDate } = getProjectsDateRange(projects);

    const hasRange = minDate && maxDate;

    if (viewMode === '4months') {
      if (!hasRange) {
        const today = new Date();
        const startDate = dateUtils.getMonthStart(today);
        const endDate = dateUtils.getMonthEnd(dateUtils.addMonths(startDate, 3));
        return { startDate, endDate };
      }

      const startDate = dateUtils.addDays(minDate, -config.gantt.MARGIN_DAYS);
      const endDate = dateUtils.addDays(maxDate, config.gantt.MARGIN_DAYS);
      return { startDate, endDate };
    }

    // If no dates found, use 4 months range as fallback
    if (!hasRange) {
      const today = new Date();
      const startDate = dateUtils.getMonthStart(today);
      const endDate = dateUtils.getMonthEnd(dateUtils.addMonths(startDate, 3));
      return { startDate, endDate };
    }

    // Add margin days (1 week before and after)
    const startDate = dateUtils.addDays(minDate, -config.gantt.MARGIN_DAYS);
    const endDate = dateUtils.addDays(maxDate, config.gantt.MARGIN_DAYS);

    return { startDate, endDate };
  }

  /**
   * Calculate pixels per day
   */
  function calculatePixelsPerDay(viewMode, totalDays, containerWidth) {
    if (viewMode === '4months') {
      const visibleDays = 120;
      const availableWidth = containerWidth - config.gantt.CANVAS_LEFT_MARGIN - config.gantt.CANVAS_RIGHT_MARGIN;
      const pixelsPerDay = availableWidth / visibleDays;
      return Math.max(1, pixelsPerDay);
    }

    const availableWidth = containerWidth - config.gantt.CANVAS_LEFT_MARGIN - config.gantt.CANVAS_RIGHT_MARGIN;
    return Math.max(0.2, availableWidth / totalDays);
  }

  /**
   * Build layout for rendering
   */
  function buildLayout(viewMode, projects, containerWidth, filters) {
    const { startDate, endDate } = calculateTimelineRange(viewMode, projects);
    const totalDays = dateUtils.daysDiff(startDate, endDate) + 1;
    const pixelsPerDay = calculatePixelsPerDay(viewMode, totalDays, containerWidth);

    const canvasWidth = config.gantt.CANVAS_LEFT_MARGIN + (totalDays * pixelsPerDay) + config.gantt.CANVAS_RIGHT_MARGIN;

    // One row per project
    const rows = [];
    let currentY = config.gantt.CANVAS_TOP_MARGIN;

    projects.forEach(project => {
      rows.push({
        type: 'project',
        project,
        y: currentY,
        height: config.gantt.PROJECT_BAR_HEIGHT
      });
      currentY += config.gantt.ROW_HEIGHT;
    });

    const canvasHeight = currentY + config.gantt.CANVAS_BOTTOM_MARGIN;

    // Build date-to-X map
    const dateToX = {};
    for (let i = 0; i < totalDays; i++) {
      const date = dateUtils.addDays(startDate, i);
      const dateStr = dateUtils.formatDate(date);
      dateToX[dateStr] = config.gantt.CANVAS_LEFT_MARGIN + (i * pixelsPerDay);
    }

    // Build month spans
    const months = [];
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (currentMonth <= endDate) {
      const monthEnd = dateUtils.getMonthEnd(currentMonth);
      const visibleStart = currentMonth < startDate ? startDate : currentMonth;
      const visibleEnd = monthEnd > endDate ? endDate : monthEnd;

      const x1 = dateToX[dateUtils.formatDate(visibleStart)];
      const x2 = dateToX[dateUtils.formatDate(visibleEnd)] + pixelsPerDay;

      months.push({
        date: new Date(currentMonth),
        x: x1,
        width: x2 - x1
      });

      currentMonth = dateUtils.addMonths(currentMonth, 1);
    }

    // Build year spans
    const years = [];
    let currentYear = new Date(startDate.getFullYear(), 0, 1);
    while (currentYear <= endDate) {
      const yearEnd = new Date(currentYear.getFullYear(), 11, 31);
      const visibleStart = currentYear < startDate ? startDate : currentYear;
      const visibleEnd = yearEnd > endDate ? endDate : yearEnd;

      const x1 = dateToX[dateUtils.formatDate(visibleStart)];
      const x2 = dateToX[dateUtils.formatDate(visibleEnd)] + pixelsPerDay;

      years.push({
        year: currentYear.getFullYear(),
        x: x1,
        width: x2 - x1
      });

      currentYear = new Date(currentYear.getFullYear() + 1, 0, 1);
    }

    // Build week spans
    const weeks = [];
    const allDates = dateUtils.getDateRange(startDate, endDate);
    let currentWeekStart = null;
    let currentWeekDates = [];

    allDates.forEach(date => {
      const weekStart = dateUtils.getWeekStart(date);
      const weekStartStr = dateUtils.formatDate(weekStart);

      if (weekStartStr !== currentWeekStart) {
        if (currentWeekDates.length > 0) {
          const firstDate = currentWeekDates[0];
          const lastDate = currentWeekDates[currentWeekDates.length - 1];
          const x1 = dateToX[dateUtils.formatDate(firstDate)];
          const x2 = dateToX[dateUtils.formatDate(lastDate)] + pixelsPerDay;

          weeks.push({
            weekNumber: dateUtils.getISOWeek(firstDate),
            x: x1,
            width: x2 - x1
          });
        }

        currentWeekStart = weekStartStr;
        currentWeekDates = [date];
      } else {
        currentWeekDates.push(date);
      }
    });

    if (currentWeekDates.length > 0) {
      const firstDate = currentWeekDates[0];
      const lastDate = currentWeekDates[currentWeekDates.length - 1];
      const x1 = dateToX[dateUtils.formatDate(firstDate)];
      const x2 = dateToX[dateUtils.formatDate(lastDate)] + pixelsPerDay;

      weeks.push({
        weekNumber: dateUtils.getISOWeek(firstDate),
        x: x1,
        width: x2 - x1
      });
    }

    return {
      viewMode,
      startDate,
      endDate,
      totalDays,
      pixelsPerDay,
      canvasWidth,
      canvasHeight,
      dateToX,
      months,
      years,
      weeks,
      rows,
      filters
    };
  }

  /**
   * Get or build layout
   */
  function getLayout(viewMode, projects, containerWidth, filters) {
    const projectsKey = JSON.stringify(projects);
    if (layoutCache &&
        layoutCache.viewMode === viewMode &&
        layoutCache.containerWidth === containerWidth &&
        JSON.stringify(layoutCache.filters) === JSON.stringify(filters) &&
        layoutCache.projectsKey === projectsKey) {
      return layoutCache.layout;
    }

    const layout = buildLayout(viewMode, projects, containerWidth, filters);
    layoutCache = {
      viewMode,
      containerWidth,
      filters,
      projectsKey,
      layout
    };
    return layout;
  }

  function ellipsizeText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    const ellipsis = '...';
    let truncated = text;

    while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }

    return truncated ? truncated + ellipsis : ellipsis;
  }

  /**
   * Render Gantt chart
   */
  function render(ctx, layout) {
    const { canvasWidth, canvasHeight, months, years, weeks, rows, dateToX, pixelsPerDay, startDate, endDate, filters } = layout;

    ctx.imageSmoothingEnabled = false;

    const headerBaseY = config.gantt.CANVAS_TOP_MARGIN;
    const headerDayNumberY = headerBaseY - 14;
    const headerDayLetterY = headerBaseY - 30;
    const headerWeekY = headerBaseY - 50;
    const headerMsY = headerBaseY - 68;
    const headerTodayY = headerBaseY - 86;
    const headerMonthY = headerBaseY - 102;
    const headerMonthLabelY = headerBaseY - 114;
    const headerYearY = headerBaseY - 124;

    // Background
    ctx.fillStyle = config.gantt.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvasWidth, headerDayNumberY + 8);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = config.gantt.TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (filters.showYearLabels) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = config.gantt.TEXT_SMALL_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText('Anni', config.gantt.CANVAS_LEFT_MARGIN, headerYearY);

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = config.gantt.TEXT_COLOR;
      ctx.textAlign = 'center';
      years.forEach(year => {
        ctx.fillText(`${year.year}`, year.x + year.width / 2, headerYearY);
      });
    }

    if (filters.showMonthYearLabels) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = config.gantt.TEXT_SMALL_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText('Mesi', config.gantt.CANVAS_LEFT_MARGIN, headerMonthLabelY);

      months.forEach(month => {
        const monthName = month.date.toLocaleDateString('it-IT', {
          month: 'long',
          year: layout.viewMode === '4months' ? 'numeric' : undefined
        });
        const capitalizedName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = config.gantt.TEXT_COLOR;
        ctx.fillText(capitalizedName, month.x + month.width / 2, headerMonthY);
      });
    }

    const projectAreaTop = rows.length ? rows[0].y : config.gantt.CANVAS_TOP_MARGIN;
    const projectAreaBottom = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : config.gantt.CANVAS_TOP_MARGIN;
    const projectAreaLeft = config.gantt.CANVAS_LEFT_MARGIN;
    const projectAreaRight = canvasWidth - config.gantt.CANVAS_RIGHT_MARGIN;

    // Weeks grid
    if (filters.showWeekSeparators) {
      ctx.strokeStyle = config.gantt.GRID_COLOR;
      ctx.lineWidth = 1;

      weeks.forEach(week => {
        ctx.beginPath();
        ctx.moveTo(week.x, projectAreaTop);
        ctx.lineTo(week.x, projectAreaBottom);
        ctx.stroke();
      });
    }

    // Days grid
    if (filters.showDaySeparators) {
      ctx.strokeStyle = config.gantt.GRID_LIGHT_COLOR;
      ctx.lineWidth = 0.5;

      const allDates = dateUtils.getDateRange(startDate, endDate);
      allDates.forEach(date => {
        const x = dateToX[dateUtils.formatDate(date)];
        ctx.beginPath();
        ctx.moveTo(x, projectAreaTop);
        ctx.lineTo(x, projectAreaBottom);
        ctx.stroke();
      });
    }

    // Week numbers
    if (filters.showWeekNumbers) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = config.gantt.TEXT_SMALL_COLOR;
      ctx.textAlign = 'center';

      weeks.forEach(week => {
        ctx.fillText(`W${week.weekNumber}`, week.x + week.width / 2, headerWeekY);
      });
    }

    // Day letters/numbers
    if (filters.showDayLetters || filters.showDayNumbers) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = config.gantt.TEXT_SMALL_COLOR;
      ctx.textAlign = 'center';

      const allDates = dateUtils.getDateRange(startDate, endDate);
      allDates.forEach(date => {
        const x = dateToX[dateUtils.formatDate(date)] + pixelsPerDay / 2;
        const dayLetter = ['D', 'L', 'M', 'M', 'G', 'V', 'S'][date.getDay()];
        if (filters.showDayLetters) {
          ctx.fillText(dayLetter, x, headerDayLetterY);
        }
        if (filters.showDayNumbers) {
          ctx.fillText(date.getDate().toString(), x, headerDayNumberY);
        }
      });
    }

    // Month separators
    if (filters.showMonthSeparators) {
      ctx.strokeStyle = config.gantt.GRID_COLOR;
      ctx.lineWidth = 2;
      months.forEach(month => {
        ctx.beginPath();
        ctx.moveTo(month.x, projectAreaTop);
        ctx.lineTo(month.x, projectAreaBottom);
        ctx.stroke();
      });
    }

    // Year separators
    if (filters.showYearSeparators) {
      ctx.strokeStyle = config.gantt.GRID_COLOR;
      ctx.lineWidth = 3;
      months.forEach(month => {
        if (month.date.getMonth() === 0) {
          ctx.beginPath();
          ctx.moveTo(month.x, projectAreaTop);
          ctx.lineTo(month.x, projectAreaBottom);
          ctx.stroke();
        }
      });
    }

    // Weekends
    if (filters.showWeekends) {
      const allDates = dateUtils.getDateRange(startDate, endDate);
      allDates.forEach(date => {
        if (dateUtils.isWeekend(date)) {
          const x = dateToX[dateUtils.formatDate(date)];
          ctx.fillStyle = config.gantt.WEEKEND_COLOR;
          ctx.fillRect(x, projectAreaTop, pixelsPerDay, projectAreaBottom - projectAreaTop);
        }
      });
    }

    // Holidays
    if (filters.showHolidays) {
      const allDates = dateUtils.getDateRange(startDate, endDate);
      allDates.forEach(date => {
        if (dateUtils.isItalianHoliday(date)) {
          const x = dateToX[dateUtils.formatDate(date)];
          ctx.fillStyle = config.gantt.HOLIDAY_COLOR;
          ctx.fillRect(x, projectAreaTop, pixelsPerDay, projectAreaBottom - projectAreaTop);
        }
      });
    }

    // Collect milestones
    const milestones = [];
    rows.forEach(row => {
      if (Array.isArray(row.project.fasi)) {
        row.project.fasi.forEach(fase => {
          if (fase.milestone && fase.dataFine) {
            const x = dateToX[fase.dataFine];
            if (x !== null && x !== undefined) {
              milestones.push({ x, fase, project: row.project, row });
            }
          }
        });
      }
    });

    // Today line and label
    const today = new Date();
    const todayX = dateToX[dateUtils.formatDate(today)];

    if (todayX !== null && todayX !== undefined) {
      const todayLineTop = headerTodayY + 10;
      ctx.strokeStyle = config.gantt.TODAY_LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(todayX, todayLineTop);
      ctx.lineTo(todayX, projectAreaBottom);
      ctx.stroke();

      ctx.fillStyle = config.gantt.TODAY_LINE_COLOR;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Oggi', todayX, headerTodayY);
    }

    if (rows.length > 0) {
      ctx.strokeStyle = config.gantt.GRID_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        projectAreaLeft,
        projectAreaTop,
        projectAreaRight - projectAreaLeft,
        projectAreaBottom - projectAreaTop
      );
    }

    // Projects
    rows.forEach(row => {
      const project = row.project;

      // Project label
      ctx.fillStyle = config.gantt.TEXT_COLOR;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelPadding = 8;
      const labelMaxWidth = Math.max(0, config.gantt.CANVAS_LEFT_MARGIN - labelPadding * 2);
      const labelText = ellipsizeText(ctx, project.nome || 'Unnamed', labelMaxWidth);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, row.y, config.gantt.CANVAS_LEFT_MARGIN, row.height);
      ctx.clip();
      ctx.fillText(labelText, labelPadding, row.y + row.height / 2);
      ctx.restore();

      // Project bar
      if (project.dataInizio && project.dataFine) {
        const x1 = dateToX[project.dataInizio];
        const x2 = dateToX[project.dataFine];

        if (x1 !== null && x2 !== null) {
          const barWidth = x2 - x1 + pixelsPerDay;
          const barY = row.y;
          const barHeight = row.height;

          // Container bar
          ctx.fillStyle = config.gantt.PROJECT_BAR_COLOR;
          ctx.fillRect(x1, barY, barWidth, barHeight);

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, barY, barWidth, barHeight);

          // Phases inside
          if (Array.isArray(project.fasi)) {
            project.fasi.forEach(fase => {
              if (!fase.milestone && fase.dataInizio && fase.dataFine) {
                const fx1 = dateToX[fase.dataInizio];
                const fx2 = dateToX[fase.dataFine];

                if (fx1 !== null && fx2 !== null) {
                  const faseWidth = fx2 - fx1 + pixelsPerDay;
                  const faseY = barY + 4;
                  const faseHeight = barHeight - 8;

                  ctx.fillStyle = fase.colore || project.colore || '#3b82f6';
                  ctx.fillRect(fx1, faseY, faseWidth, faseHeight);

                  ctx.strokeStyle = '#1e293b';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(fx1, faseY, faseWidth, faseHeight);

                  // Alert
                  if (filters.highlightDelays && logic.isDelayed(fase)) {
                    ctx.strokeStyle = config.gantt.TODAY_LINE_COLOR;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 2]);
                    ctx.strokeRect(fx1, faseY, faseWidth, faseHeight);
                    ctx.setLineDash([]);
                  }

                  // Text (left-aligned with ellipsis)
                  const percentage = fase.percentualeCompletamento || 0;
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 10px sans-serif';
                  ctx.textAlign = 'left';
                  ctx.textBaseline = 'middle';

                  const padding = 4;
                  const availableWidth = faseWidth - (padding * 2);

                  if (availableWidth > 6) {
                    const percentText = `${percentage}%`;
                    const percentWidth = ctx.measureText(percentText).width;
                    const nameWidthAvailable = availableWidth - percentWidth - 6;
                    const nameText = fase.nome || '';
                    let label = percentText;

                    if (nameWidthAvailable > 8) {
                      const trimmedName = ellipsizeText(ctx, nameText, nameWidthAvailable);
                      label = `${trimmedName}${trimmedName ? ' ' : ''}${percentText}`;
                    }

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(fx1 + padding, faseY, availableWidth, faseHeight);
                    ctx.clip();
                    ctx.fillText(label, fx1 + padding, faseY + faseHeight / 2);
                    ctx.restore();
                  }
                }
              }

            });
          }
        }
      }
    });

    // Milestone vertical lines (upwards only)
    ctx.strokeStyle = config.gantt.MILESTONE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    milestones.forEach(ms => {
      const lineY = ms.row.y + ms.row.height / 2;
      ctx.beginPath();
      ctx.moveTo(ms.x, lineY);
      ctx.lineTo(ms.x, headerMsY + 6);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // MS labels (in header, staggered to avoid overlap)
    ctx.fillStyle = config.gantt.MILESTONE_COLOR;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const msLabelText = 'MS';
    const msLabelPadding = 4;
    const msLabelSpacing = 8;
    const msLabelRowHeight = 12;
    const msLabelWidth = ctx.measureText(msLabelText).width + (msLabelPadding * 2);
    const msLabelRows = [];
    const msLabelPlacements = [];

    milestones
      .slice()
      .sort((a, b) => a.x - b.x)
      .forEach(ms => {
        let targetRow = msLabelRows.findIndex(lastX => ms.x - lastX >= msLabelWidth + msLabelSpacing);
        if (targetRow === -1) {
          targetRow = msLabelRows.length;
          msLabelRows.push(-Infinity);
        }
        msLabelRows[targetRow] = ms.x;
        msLabelPlacements.push({ x: ms.x, rowIndex: targetRow });
      });

    msLabelPlacements.forEach(label => {
      const y = headerMsY - (label.rowIndex * msLabelRowHeight);
      ctx.fillText(msLabelText, label.x, y);
    });

    // Milestones (diamonds)
    milestones.forEach(ms => {
      const mx = ms.x;
      const centerY = ms.row.y + ms.row.height / 2;
      const size = 8;

      ctx.fillStyle = config.gantt.MILESTONE_COLOR;
      ctx.beginPath();
      ctx.moveTo(mx, centerY - size);
      ctx.lineTo(mx + size, centerY);
      ctx.lineTo(mx, centerY + size);
      ctx.lineTo(mx - size, centerY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  /**
   * Hit test
   */
  function hitTest(mouseX, mouseY, layout) {
    for (const row of layout.rows) {
      // Check phases first (higher priority)
      if (Array.isArray(row.project.fasi)) {
        for (const fase of row.project.fasi) {
          // Milestone
          if (fase.milestone && fase.dataFine) {
            const x = layout.dateToX[fase.dataFine];
            if (x !== null) {
              const centerY = row.y + row.height / 2;
              const size = 8;

              if (mouseX >= x - size && mouseX <= x + size &&
                  mouseY >= centerY - size && mouseY <= centerY + size) {
                return { type: 'phase', phase: fase, project: row.project };
              }
            }
          }

          // Phase bar
          if (!fase.milestone && fase.dataInizio && fase.dataFine) {
            const x1 = layout.dateToX[fase.dataInizio];
            const x2 = layout.dateToX[fase.dataFine];

            if (x1 !== null && x2 !== null) {
              const barWidth = x2 - x1 + layout.pixelsPerDay;
              const barY = row.y + 4;
              const barHeight = row.height - 8;

              if (mouseX >= x1 && mouseX <= x1 + barWidth &&
                  mouseY >= barY && mouseY <= barY + barHeight) {
                return { type: 'phase', phase: fase, project: row.project };
              }
            }
          }
        }
      }

      // Check project bar (lower priority, only if not over a phase)
      const project = row.project;
      if (project.dataInizio && project.dataFine) {
        const x1 = layout.dateToX[project.dataInizio];
        const x2 = layout.dateToX[project.dataFine];

        if (x1 !== null && x2 !== null) {
          const barWidth = x2 - x1 + layout.pixelsPerDay;
          const barY = row.y;
          const barHeight = row.height;

          if (mouseX >= x1 && mouseX <= x1 + barWidth &&
              mouseY >= barY && mouseY <= barY + barHeight) {
            return { type: 'project', project: project };
          }
        }
      }
    }

    // Empty space
    if (mouseX >= config.gantt.CANVAS_LEFT_MARGIN) {
      const dayOffset = Math.floor((mouseX - config.gantt.CANVAS_LEFT_MARGIN) / layout.pixelsPerDay);
      const date = dateUtils.addDays(layout.startDate, dayOffset);
      return { type: 'date', date: dateUtils.formatDate(date) };
    }

    return null;
  }

  window.OnlyGantt.gantt = {
    invalidateCache,
    getLayout,
    render,
    hitTest
  };
})();
