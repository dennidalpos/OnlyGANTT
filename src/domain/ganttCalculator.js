import { AppConfig } from '../app-config.js';
import dateUtils from '../utils/dateUtils.js';
import logic from './projectLogic.js';

let layoutCache = null;
let textMeasurementCache = new Map();
const MAX_TEXT_CACHE_SIZE = 500;

export function invalidateCache() {
  layoutCache = null;
}

export function clearTextCache() {
  textMeasurementCache.clear();
}

export function getCachedTextWidth(ctx, text, font) {
  const key = `${font}:${text}`;
  if (textMeasurementCache.has(key)) {
    return textMeasurementCache.get(key);
  }

  if (textMeasurementCache.size >= MAX_TEXT_CACHE_SIZE) {
    const firstKey = textMeasurementCache.keys().next().value;
    textMeasurementCache.delete(firstKey);
  }

  const width = ctx.measureText(text).width;
  textMeasurementCache.set(key, width);
  return width;
}

export function getProjectsDateRange(projects) {
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

export function calculateTimelineRange(viewMode, projects) {
  const { minDate, maxDate } = getProjectsDateRange(projects);
  const hasRange = minDate && maxDate;

  if (viewMode === '4months') {
    if (!hasRange) {
      const today = new Date();
      const startDate = dateUtils.getMonthStart(today);
      const endDate = dateUtils.getMonthEnd(dateUtils.addMonths(startDate, 2));
      return { startDate, endDate };
    }
    const startDate = dateUtils.addDays(minDate, -AppConfig.gantt.MARGIN_DAYS);
    const endDate = dateUtils.addDays(maxDate, AppConfig.gantt.MARGIN_DAYS);
    return { startDate, endDate };
  }

  if (!hasRange) {
    const today = new Date();
    const startDate = dateUtils.getMonthStart(today);
    const endDate = dateUtils.getMonthEnd(dateUtils.addMonths(startDate, 2));
    return { startDate, endDate };
  }

  const startDate = dateUtils.addDays(minDate, -AppConfig.gantt.MARGIN_DAYS);
  const endDate = dateUtils.addDays(maxDate, AppConfig.gantt.MARGIN_DAYS);
  return { startDate, endDate };
}

export function calculatePixelsPerDay(viewMode, totalDays, containerWidth) {
  if (viewMode === '4months') {
    const visibleDays = 90;
    const availableWidth = containerWidth - AppConfig.gantt.CANVAS_LEFT_MARGIN - AppConfig.gantt.CANVAS_RIGHT_MARGIN;
    const pixelsPerDay = availableWidth / visibleDays;
    return Math.max(1, pixelsPerDay);
  }

  const availableWidth = containerWidth - AppConfig.gantt.CANVAS_LEFT_MARGIN - AppConfig.gantt.CANVAS_RIGHT_MARGIN;
  return Math.max(0.2, availableWidth / totalDays);
}

export function buildLayout(viewMode, projects, containerWidth, filters) {
  const { startDate, endDate } = calculateTimelineRange(viewMode, projects);
  const totalDays = dateUtils.daysDiff(startDate, endDate) + 1;
  const pixelsPerDay = calculatePixelsPerDay(viewMode, totalDays, containerWidth);

  const canvasWidth = AppConfig.gantt.CANVAS_LEFT_MARGIN + (totalDays * pixelsPerDay) + AppConfig.gantt.CANVAS_RIGHT_MARGIN;

  const rows = [];
  let currentY = AppConfig.gantt.CANVAS_TOP_MARGIN;

  projects.forEach(project => {
    rows.push({
      type: 'project',
      project,
      y: currentY,
      height: AppConfig.gantt.ROW_HEIGHT
    });
    currentY += AppConfig.gantt.ROW_HEIGHT;
  });

  const canvasHeight = currentY + AppConfig.gantt.CANVAS_BOTTOM_MARGIN;

  const dateToX = {};
  for (let i = 0; i < totalDays; i++) {
    const date = dateUtils.addDays(startDate, i);
    const dateStr = dateUtils.formatDate(date);
    dateToX[dateStr] = AppConfig.gantt.CANVAS_LEFT_MARGIN + (i * pixelsPerDay);
  }

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

export function getLayout(viewMode, projects, containerWidth, filters) {
  const projectsCount = projects.length;
  const projectsHash = projects.reduce((hash, p, i) => {
    return hash + (p.id || i) + (p.dataInizio || '') + (p.dataFine || '') + (p.fasi ? p.fasi.length : 0);
  }, '');

  const filtersHash = Object.keys(filters).sort().map(k => `${k}:${filters[k]}`).join(',');

  if (layoutCache &&
      layoutCache.viewMode === viewMode &&
      layoutCache.containerWidth === containerWidth &&
      layoutCache.projectsCount === projectsCount &&
      layoutCache.projectsHash === projectsHash &&
      layoutCache.filtersHash === filtersHash) {
    return layoutCache.layout;
  }

  const layout = buildLayout(viewMode, projects, containerWidth, filters);
  layoutCache = {
    viewMode,
    containerWidth,
    projectsCount,
    projectsHash,
    filtersHash,
    layout
  };
  return layout;
}

export function ellipsizeText(ctx, text, maxWidth) {
  const font = ctx.font;
  const fullWidth = getCachedTextWidth(ctx, text, font);

  if (fullWidth <= maxWidth) {
    return text;
  }

  const ellipsis = '...';
  const ellipsisWidth = getCachedTextWidth(ctx, ellipsis, font);

  if (ellipsisWidth >= maxWidth) {
    return ellipsis;
  }

  let low = 0;
  let high = text.length;
  let result = ellipsis;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = text.slice(0, mid);
    const testText = truncated + ellipsis;
    const testWidth = getCachedTextWidth(ctx, testText, font);

    if (testWidth <= maxWidth) {
      result = testText;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export function render(ctx, layout, options = {}) {
  const { canvasWidth, canvasHeight, months, years, weeks, rows, dateToX, pixelsPerDay, startDate, endDate, filters } = layout;
  const { hoveredProjectId, viewport } = options;

  const visibleRows = viewport
    ? rows.filter(row => {
        const rowBottom = row.y + row.height;
        return rowBottom >= viewport.top && row.y <= viewport.bottom;
      })
    : rows;

  ctx.imageSmoothingEnabled = false;

  const headerBaseY = AppConfig.gantt.CANVAS_TOP_MARGIN;
  const headerTodayY = headerBaseY - 18;
  const headerDayNumberY = headerBaseY - 38;
  const headerDayLetterY = headerBaseY - 56;
  const headerWeekY = headerBaseY - 76;
  const headerMsY = headerBaseY - 98;
  const headerMonthY = headerBaseY - 120;
  const headerYearY = headerBaseY - 142;

  const projectAreaTop = rows.length ? rows[0].y : AppConfig.gantt.CANVAS_TOP_MARGIN;
  const projectAreaBottom = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : AppConfig.gantt.CANVAS_TOP_MARGIN;
  const projectAreaLeft = AppConfig.gantt.CANVAS_LEFT_MARGIN;
  const projectAreaRight = canvasWidth - AppConfig.gantt.CANVAS_RIGHT_MARGIN;

  const footerBaseY = projectAreaBottom;
  const footerTodayY = footerBaseY + 18;
  const footerDayNumberY = footerBaseY + 38;
  const footerDayLetterY = footerBaseY + 56;
  const footerWeekY = footerBaseY + 76;
  const footerMsY = footerBaseY + 98;
  const footerMonthY = footerBaseY + 120;
  const footerYearY = footerBaseY + 142;

  ctx.fillStyle = AppConfig.gantt.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvasWidth, headerDayNumberY + 8);
  ctx.fillRect(0, footerDayNumberY - 8, canvasWidth, canvasHeight - (footerDayNumberY - 8));

  const fontFamily = AppConfig.gantt.FONT_FAMILY;
  const headerFontSize = AppConfig.gantt.HEADER_FONT_SIZE;
  const headerSmallFontSize = AppConfig.gantt.HEADER_SMALL_FONT_SIZE;
  const headerTinyFontSize = AppConfig.gantt.HEADER_TINY_FONT_SIZE;

  ctx.font = `bold ${headerFontSize}px ${fontFamily}`;
  ctx.fillStyle = AppConfig.gantt.TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (filters.showYearLabels) {
    ctx.font = `bold 12px ${fontFamily}`;
    ctx.fillStyle = AppConfig.gantt.TEXT_COLOR;
    ctx.textAlign = 'center';
    years.forEach(year => {
      ctx.fillText(`${year.year}`, year.x + year.width / 2, headerYearY);
      ctx.fillText(`${year.year}`, year.x + year.width / 2, footerYearY);
    });
  }

  if (filters.showMonthYearLabels) {
    months.forEach(month => {
      const monthName = month.date.toLocaleDateString('it-IT', {
        month: 'long',
        year: layout.viewMode === '4months' ? 'numeric' : undefined
      });
      const capitalizedName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      ctx.font = `bold ${headerFontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = AppConfig.gantt.TEXT_COLOR;
      ctx.fillText(capitalizedName, month.x + month.width / 2, headerMonthY);
      ctx.fillText(capitalizedName, month.x + month.width / 2, footerMonthY);
    });
  }

  if (filters.showWeekSeparators) {
    ctx.strokeStyle = AppConfig.gantt.GRID_COLOR;
    ctx.lineWidth = 1;
    weeks.forEach(week => {
      ctx.beginPath();
      ctx.moveTo(week.x, projectAreaTop);
      ctx.lineTo(week.x, projectAreaBottom);
      ctx.stroke();
    });
  }

  if (filters.showDaySeparators) {
    ctx.strokeStyle = AppConfig.gantt.GRID_LIGHT_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < layout.totalDays; i++) {
      const x = AppConfig.gantt.CANVAS_LEFT_MARGIN + (i * pixelsPerDay);
      ctx.moveTo(x, projectAreaTop);
      ctx.lineTo(x, projectAreaBottom);
    }
    ctx.stroke();
  }

  if (filters.showWeekNumbers) {
    ctx.font = `${headerSmallFontSize}px ${fontFamily}`;
    ctx.fillStyle = AppConfig.gantt.TEXT_SMALL_COLOR;
    ctx.textAlign = 'center';
    weeks.forEach(week => {
      ctx.fillText(`W${week.weekNumber}`, week.x + week.width / 2, headerWeekY);
      ctx.fillText(`W${week.weekNumber}`, week.x + week.width / 2, footerWeekY);
    });
  }

  if (filters.showDayLetters || filters.showDayNumbers) {
    ctx.font = `${headerTinyFontSize}px ${fontFamily}`;
    ctx.fillStyle = AppConfig.gantt.TEXT_SMALL_COLOR;
    ctx.textAlign = 'center';

    const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
    const currentDate = new Date(startDate);

    for (let i = 0; i < layout.totalDays; i++) {
      const x = AppConfig.gantt.CANVAS_LEFT_MARGIN + (i * pixelsPerDay) + pixelsPerDay / 2;
      const dayOfWeek = currentDate.getDay();

      if (filters.showDayLetters) {
        ctx.fillText(dayLetters[dayOfWeek], x, headerDayLetterY);
        ctx.fillText(dayLetters[dayOfWeek], x, footerDayLetterY);
      }
      if (filters.showDayNumbers) {
        ctx.fillText(currentDate.getDate().toString(), x, headerDayNumberY);
        ctx.fillText(currentDate.getDate().toString(), x, footerDayNumberY);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  if (filters.showMonthSeparators) {
    ctx.strokeStyle = AppConfig.gantt.GRID_COLOR;
    ctx.lineWidth = 2;
    months.forEach(month => {
      ctx.beginPath();
      ctx.moveTo(month.x, projectAreaTop);
      ctx.lineTo(month.x, projectAreaBottom);
      ctx.stroke();
    });
  }

  if (filters.showYearSeparators) {
    ctx.strokeStyle = AppConfig.gantt.GRID_COLOR;
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

  if (filters.showWeekends || filters.showHolidays) {
    const currentDate = new Date(startDate);
    const heightArea = projectAreaBottom - projectAreaTop;

    for (let i = 0; i < layout.totalDays; i++) {
      const x = AppConfig.gantt.CANVAS_LEFT_MARGIN + (i * pixelsPerDay);

      if (filters.showWeekends && dateUtils.isWeekend(currentDate)) {
        ctx.fillStyle = AppConfig.gantt.WEEKEND_COLOR;
        ctx.fillRect(x, projectAreaTop, pixelsPerDay, heightArea);
      }

      if (filters.showHolidays && dateUtils.isItalianHoliday(currentDate)) {
        ctx.fillStyle = AppConfig.gantt.HOLIDAY_COLOR;
        ctx.fillRect(x, projectAreaTop, pixelsPerDay, heightArea);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const milestones = [];
  visibleRows.forEach(row => {
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

  const today = new Date();
  const todayX = dateToX[dateUtils.formatDate(today)];

  const drawTodayLabel = (text, x, y) => {
    const paddingX = 5;
    const paddingY = 3;
    const width = ctx.measureText(text).width + (paddingX * 2);
    const height = 15 + (paddingY * 2);
    const left = x - width / 2;
    const top = y - height / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = AppConfig.gantt.TODAY_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  };

  const drawTodayMarker = () => {
    if (todayX === null || todayX === undefined || todayX < projectAreaLeft) return;

    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = AppConfig.gantt.TODAY_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(todayX, projectAreaTop);
    ctx.lineTo(todayX, projectAreaBottom);
    ctx.stroke();

    ctx.fillStyle = AppConfig.gantt.TODAY_LINE_COLOR;
    ctx.font = `bold 11px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTodayLabel('Oggi', todayX, headerTodayY);
    drawTodayLabel('Oggi', todayX, footerTodayY);
    ctx.restore();
  };

  if (rows.length > 0) {
    ctx.strokeStyle = AppConfig.gantt.GRID_COLOR;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      projectAreaLeft,
      projectAreaTop,
      projectAreaRight - projectAreaLeft,
      projectAreaBottom - projectAreaTop
    );
  }

  visibleRows.forEach(row => {
    const project = row.project;
    const isHovered = hoveredProjectId && project.id === hoveredProjectId;

    if (isHovered) {
      const highlightHeight = 32;
      const highlightY = row.y + (row.height - highlightHeight) / 2;
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.fillRect(0, highlightY, canvasWidth, highlightHeight);
    }

    if (project.dataInizio && project.dataFine) {
      const x1 = dateToX[project.dataInizio];
      const x2 = dateToX[project.dataFine];

      if (x1 !== null && x2 !== null) {
        const barWidth = x2 - x1 + pixelsPerDay;
        const barY = row.y;
        const barHeight = row.height;

        ctx.fillStyle = AppConfig.gantt.PROJECT_BAR_COLOR;
        ctx.fillRect(x1, barY, barWidth, barHeight);

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, barY, barWidth, barHeight);

        if (Array.isArray(project.fasi)) {
          project.fasi.forEach(fase => {
            if (filters.showOnlyMilestones && !fase.milestone) return;
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

                if (filters.highlightDelays && logic.isDelayed(fase)) {
                  ctx.strokeStyle = AppConfig.gantt.TODAY_LINE_COLOR;
                  ctx.lineWidth = 2;
                  ctx.setLineDash([4, 2]);
                  ctx.strokeRect(fx1, faseY, faseWidth, faseHeight);
                  ctx.setLineDash([]);
                }

                const showLabels = filters.showPhaseLabels;
                const showPercent = filters.showPhasePercentages;

                if (showLabels || showPercent) {
                  const percentage = fase.percentualeCompletamento || 0;
                  const phaseFontSize = AppConfig.gantt.PHASE_FONT_SIZE;
                  const phaseFontWeight = AppConfig.gantt.PHASE_FONT_WEIGHT;
                  const padding = AppConfig.gantt.PHASE_TEXT_PADDING;

                  ctx.fillStyle = '#ffffff';
                  ctx.font = `${phaseFontWeight} ${phaseFontSize}px ${fontFamily}`;
                  ctx.textAlign = 'left';
                  ctx.textBaseline = 'middle';

                  const availableWidth = faseWidth - (padding * 2);

                  if (availableWidth > 10) {
                    const percentText = showPercent ? `${percentage}%` : '';
                    const percentWidth = showPercent ? ctx.measureText(percentText).width : 0;
                    const nameText = showLabels ? (fase.nome || '') : '';
                    let label = '';

                    if (showLabels && showPercent) {
                      const nameWidthAvailable = availableWidth - percentWidth - 8;
                      if (nameWidthAvailable > 12) {
                        const trimmedName = ellipsizeText(ctx, nameText, nameWidthAvailable);
                        label = `${trimmedName}${trimmedName ? ' ' : ''}${percentText}`;
                      } else {
                        label = percentText;
                      }
                    } else if (showPercent) {
                      label = percentText;
                    } else if (showLabels) {
                      label = ellipsizeText(ctx, nameText, availableWidth);
                    }

                    if (label) {
                      ctx.save();
                      ctx.beginPath();
                      ctx.rect(fx1 + padding, faseY, availableWidth, faseHeight);
                      ctx.clip();

                      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
                      ctx.lineWidth = 2;
                      ctx.strokeText(label, fx1 + padding, faseY + faseHeight / 2);
                      ctx.fillText(label, fx1 + padding, faseY + faseHeight / 2);

                      ctx.restore();
                    }
                  }
                }
              }
            }
          });
        }
      }
    }
  });

  ctx.strokeStyle = AppConfig.gantt.MILESTONE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 4]);

  milestones.forEach(ms => {
    ctx.beginPath();
    ctx.moveTo(ms.x, headerMsY + 6);
    ctx.lineTo(ms.x, footerMsY - 6);
    ctx.stroke();
  });

  ctx.setLineDash([]);

  ctx.fillStyle = AppConfig.gantt.MILESTONE_COLOR;
  ctx.font = `bold ${headerSmallFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const msLabelText = 'MS';
  const msLabelPadding = 4;
  const msLabelSpacing = 8;
  const msLabelWidth = ctx.measureText(msLabelText).width + (msLabelPadding * 2);
  const minDistance = msLabelWidth + msLabelSpacing;

  const sortedMilestones = milestones.slice().sort((a, b) => a.x - b.x);
  const msGroups = [];

  sortedMilestones.forEach(ms => {
    const lastGroup = msGroups[msGroups.length - 1];
    if (lastGroup && ms.x - lastGroup.maxX < minDistance) {
      lastGroup.items.push(ms);
      lastGroup.maxX = ms.x;
    } else {
      msGroups.push({
        items: [ms],
        minX: ms.x,
        maxX: ms.x
      });
    }
  });

  msGroups.forEach(group => {
    const centerX = (group.minX + group.maxX) / 2;
    ctx.fillText(msLabelText, centerX, headerMsY);
    ctx.fillText(msLabelText, centerX, footerMsY);
  });

  milestones.forEach(ms => {
    const mx = ms.x;
    const centerY = ms.row.y + ms.row.height / 2;
    const size = 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.moveTo(mx, centerY - size - 2);
    ctx.lineTo(mx + size + 2, centerY);
    ctx.lineTo(mx, centerY + size + 2);
    ctx.lineTo(mx - size - 2, centerY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = AppConfig.gantt.MILESTONE_COLOR;
    ctx.beginPath();
    ctx.moveTo(mx, centerY - size);
    ctx.lineTo(mx + size, centerY);
    ctx.lineTo(mx, centerY + size);
    ctx.lineTo(mx - size, centerY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  drawTodayMarker();
}

export function hitTest(mouseX, mouseY, layout) {
  for (const row of layout.rows) {
    if (Array.isArray(row.project.fasi)) {
      for (const fase of row.project.fasi) {
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

  if (mouseX >= AppConfig.gantt.CANVAS_LEFT_MARGIN) {
    const dayOffset = Math.floor((mouseX - AppConfig.gantt.CANVAS_LEFT_MARGIN) / layout.pixelsPerDay);
    const date = dateUtils.addDays(layout.startDate, dayOffset);
    return { type: 'date', date: dateUtils.formatDate(date) };
  }

  return null;
}

const ganttCalculator = {
  invalidateCache,
  clearTextCache,
  getCachedTextWidth,
  getProjectsDateRange,
  calculateTimelineRange,
  calculatePixelsPerDay,
  buildLayout,
  getLayout,
  ellipsizeText,
  render,
  hitTest
};

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.gantt = ganttCalculator;
}

export default ganttCalculator;
