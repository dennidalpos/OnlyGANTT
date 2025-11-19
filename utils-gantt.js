window.shadeColor = function(color, amount) {
  if (!color || color[0] !== '#') return color;
  let col = color.slice(1);
  if (col.length === 3) {
    col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2];
  }
  let num = parseInt(col, 16);
  if (isNaN(num)) return color;
  let r = Math.max(0, Math.min(255, (num >> 16) + amount));
  let g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  let b = Math.max(0, Math.min(255, (num & 255) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

window.fitText = function(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length ? t + '…' : '';
};

window.getContrastColor = function(hexColor) {
  if (!hexColor || hexColor[0] !== '#') return '#000000';
  let col = hexColor.slice(1);
  if (col.length === 3) {
    col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2];
  }
  const num = parseInt(col, 16);
  if (isNaN(num)) return '#000000';

  const r = (num >> 16);
  const g = ((num >> 8) & 255);
  const b = (num & 255);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

  return luminance > 128 ? '#1f2937' : '#ffffff';
};

const GANTT_CONSTANTS = {
  MIN_BAR_WIDTH: 3,
  PROJECT_BAR_HEIGHT: 26,
  PHASE_BAR_HEIGHT: 20,
  MILESTONE_SIZE_OFFSET: 4,
  TEXT_MIN_WIDTH: 22,
  TEXT_PADDING: 4,
  TEXT_PADDING_HORIZONTAL: 8,
  STROKE_WIDTH_LATE: 2,
  DASH_PATTERN_LATE: [4, 2],
  TOOLTIP_EXTRA_MARGIN: 4,
  MARGIN_DAYS: 3,
  FONT_HEADER: "600 13px 'Inter', system-ui, sans-serif",
  FONT_MONTH: "11px 'Inter', system-ui, sans-serif",
  FONT_DAY: "10px 'Inter', system-ui, sans-serif",
  FONT_PROJECT: "600 13px 'Inter', system-ui, sans-serif",
  FONT_PHASE: "10px 'Inter', system-ui, sans-serif",
  FONT_MILESTONE: "bold 9px 'Inter', system-ui, sans-serif",
  FONT_TODAY: "bold 11px 'Inter', system-ui, sans-serif"
};

const getThemeColors = (isDarkTheme) => ({
  background: isDarkTheme ? '#020617' : '#ffffff',
  headerText: isDarkTheme ? '#e5e7eb' : '#374151',
  gridStrong: isDarkTheme ? '#4b5563' : '#9ca3af',
  gridLight: isDarkTheme ? '#1f2937' : '#e5e7eb',
  bottomAxis: isDarkTheme ? '#4b5563' : '#d1d5db',
  labelText: isDarkTheme ? '#e5e7eb' : '#374151',
  dayText: isDarkTheme ? '#9ca3af' : '#6b7280',
  emptyText: isDarkTheme ? '#6b7280' : '#9ca3af',
  todayLine: 'rgba(220, 38, 38, 0.9)',
  todayFill: 'rgba(220, 38, 38, 0.95)',
  lateStroke: 'rgba(220, 38, 38, 0.95)'
});

const calculateCanvasDimensions = (projects, parentWidth) => {
  const { CANVAS_ROW_HEIGHT, CANVAS_TOP_MARGIN, CANVAS_BOTTOM_MARGIN, CANVAS_MIN_HEIGHT, CANVAS_LEFT_MARGIN, CANVAS_RIGHT_MARGIN } = window.CONFIG;
  const totalRows = Math.max(1, projects.length);
  const cssHeight = Math.max(CANVAS_MIN_HEIGHT, CANVAS_TOP_MARGIN + CANVAS_BOTTOM_MARGIN + CANVAS_ROW_HEIGHT * totalRows);
  const plotWidth = Math.max(80, parentWidth - CANVAS_LEFT_MARGIN - CANVAS_RIGHT_MARGIN);
  
  return {
    cssHeight,
    plotWidth,
    totalRows,
    marginLeft: CANVAS_LEFT_MARGIN,
    marginRight: CANVAS_RIGHT_MARGIN,
    topMargin: CANVAS_TOP_MARGIN,
    bottomMargin: CANVAS_BOTTOM_MARGIN,
    rowHeight: CANVAS_ROW_HEIGHT
  };
};

const calculateDateRange = (projects) => {
  const bounds = window.calcolaEstremiDate(projects);
  if (!bounds) return null;

  const minDate = window.addDays(bounds.minDate, -GANTT_CONSTANTS.MARGIN_DAYS);
  const maxDate = window.addDays(bounds.maxDate, GANTT_CONSTANTS.MARGIN_DAYS);
  const totalDays = Math.max(1, window.diffInDays(minDate, maxDate) + 1);

  return {
    minDate,
    maxDate,
    totalDays,
    originalMinDate: bounds.minDate,
    originalMaxDate: bounds.maxDate
  };
};

const getUnitSize = (zoomLevel) => {
  switch (zoomLevel) {
    case window.ZOOM_LEVELS.WEEKS: return 7;
    case window.ZOOM_LEVELS.MONTHS: return 30;
    default: return 1;
  }
};

const setupCanvas = (canvas, width, height) => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
};

const drawBackground = (ctx, parentWidth, cssHeight, colors) => {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, parentWidth, cssHeight);
};

const drawMonthHeaders = (ctx, dateRange, dimensions, unitConfig, colors) => {
  const { minDate, maxDate, originalMaxDate } = dateRange;
  const { topMargin, bottomMargin, cssHeight } = dimensions;
  const { offsetToX } = unitConfig;

  ctx.fillStyle = colors.headerText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = GANTT_CONSTANTS.FONT_MONTH;

  const startYear = minDate.getFullYear();
  const endYear = maxDate.getFullYear();

  ctx.strokeStyle = colors.gridStrong;
  ctx.lineWidth = 1.2;

  for (let year = startYear; year <= endYear; year++) {
    const startMonth = year === startYear ? minDate.getMonth() : 0;
    const endMonth = year === endYear ? maxDate.getMonth() : 11;

    for (let m = startMonth; m <= endMonth; m++) {
      let monthStart = new Date(year, m, 1);
      if (monthStart > originalMaxDate) continue;
      
      let monthEnd = new Date(year, m + 1, 0);
      if (monthStart < minDate) monthStart = new Date(minDate.getTime());
      if (monthEnd > maxDate) monthEnd = new Date(maxDate.getTime());

      const offsetStart = window.diffInDays(minDate, monthStart);
      const offsetEnd = window.diffInDays(minDate, monthEnd) + 1;
      const xStart = offsetToX(offsetStart);
      const xEnd = offsetToX(offsetEnd);
      const xCenter = (xStart + xEnd) / 2;

      ctx.fillText(`${window.MONTHS[m]} ${year}`, xCenter, topMargin - 24);

      ctx.beginPath();
      ctx.moveTo(xStart + 0.5, topMargin - 4);
      ctx.lineTo(xStart + 0.5, cssHeight - bottomMargin + 4);
      ctx.stroke();
    }
  }
};

const drawDayGrid = (ctx, dateRange, dimensions, unitConfig, colors, zoomLevel) => {
  if (zoomLevel === window.ZOOM_LEVELS.MONTHS) return;

  const { minDate, maxDate } = dateRange;
  const { topMargin, bottomMargin, cssHeight } = dimensions;
  const { offsetToX } = unitConfig;

  ctx.strokeStyle = colors.gridLight;
  ctx.lineWidth = 1;
  ctx.font = GANTT_CONSTANTS.FONT_DAY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (let d = new Date(minDate.getTime()); d <= maxDate; d = window.addDays(d, 1)) {
    if (zoomLevel === window.ZOOM_LEVELS.WEEKS && d.getDay() !== 1) continue;

    const offset = window.diffInDays(minDate, d);
    const x = offsetToX(offset);

    ctx.beginPath();
    ctx.moveTo(x + 0.5, topMargin);
    ctx.lineTo(x + 0.5, cssHeight - bottomMargin + 10);
    ctx.stroke();

    ctx.fillStyle = colors.dayText;
    ctx.fillText(String(d.getDate()), x, cssHeight - bottomMargin + 14);
    ctx.fillText(window.DAY_LETTERS[d.getDay()] || '', x, cssHeight - bottomMargin + 28);
  }
};

const drawBottomAxis = (ctx, dimensions, colors) => {
  const { marginLeft, plotWidth, bottomMargin, cssHeight } = dimensions;
  
  ctx.strokeStyle = colors.bottomAxis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(marginLeft, cssHeight - bottomMargin);
  ctx.lineTo(marginLeft + plotWidth, cssHeight - bottomMargin);
  ctx.stroke();
};

const drawTodayLine = (ctx, dateRange, dimensions, unitConfig, colors) => {
  const oggi = window.parseDateStr(window.formatToday());
  if (!oggi || oggi < dateRange.minDate || oggi > dateRange.maxDate) return;

  const { topMargin, bottomMargin, cssHeight } = dimensions;
  const { offsetToX } = unitConfig;
  
  const offsetOggi = window.diffInDays(dateRange.minDate, oggi);
  const xOggi = offsetToX(offsetOggi) + 0.5;
  
  ctx.strokeStyle = colors.todayLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xOggi, topMargin);
  ctx.lineTo(xOggi, cssHeight - bottomMargin + 8);
  ctx.stroke();

  ctx.fillStyle = colors.todayFill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = GANTT_CONSTANTS.FONT_TODAY;
  ctx.fillText('Oggi', xOggi, topMargin - 40);
};

const drawProjectLabel = (ctx, project, idx, dimensions, colors) => {
  const { marginLeft, topMargin, rowHeight } = dimensions;
  const rowTop = topMargin + idx * rowHeight;
  const centerY = rowTop + rowHeight / 2;

  ctx.font = GANTT_CONSTANTS.FONT_PROJECT;
  ctx.fillStyle = colors.labelText;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const nome = project.nome || `Progetto ${idx + 1}`;
  const labelMaxWidth = marginLeft - 18;
  let labelText = nome;
  
  while (ctx.measureText(labelText).width > labelMaxWidth && labelText.length > 0) {
    labelText = labelText.slice(0, -1);
  }
  if (labelText !== nome) labelText = labelText.slice(0, -1) + '…';
  
  ctx.fillText(labelText, marginLeft - 12, centerY);
  
  return centerY;
};

const drawProjectBar = (ctx, project, centerY, dateRange, unitConfig, colors) => {
  const s = window.parseDateStr(project.dataInizio);
  const e = window.parseDateStr(project.dataFine);
  if (!s || !e) return null;

  const { minDate } = dateRange;
  const { offsetToX } = unitConfig;

  const startOffset = window.diffInDays(minDate, s);
  const endOffset = window.diffInDays(minDate, e) + 1;
  const startX = offsetToX(startOffset);
  const endX = offsetToX(endOffset);
  const width = Math.max(GANTT_CONSTANTS.MIN_BAR_WIDTH, endX - startX);

  const barY = centerY - GANTT_CONSTANTS.PROJECT_BAR_HEIGHT / 2;

  ctx.fillStyle = project.colore || '#9ca3af';
  ctx.strokeStyle = window.shadeColor(project.colore || '#9ca3af', -40);
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.rect(startX, barY, width, GANTT_CONSTANTS.PROJECT_BAR_HEIGHT);
  ctx.fill();
  ctx.stroke();

  const oggi = window.parseDateStr(window.formatToday());
  const percProj = window.normalizePercent(project.percentualeCompletamento);
  const projLate = oggi && e < oggi && percProj < 100 && project.stato !== 'completato';
  
  if (projLate) {
    ctx.save();
    ctx.strokeStyle = colors.lateStroke;
    ctx.lineWidth = GANTT_CONSTANTS.STROKE_WIDTH_LATE;
    ctx.setLineDash(GANTT_CONSTANTS.DASH_PATTERN_LATE);
    ctx.strokeRect(startX, barY, width, GANTT_CONSTANTS.PROJECT_BAR_HEIGHT);
    ctx.restore();
  }

  return { startX, barY, width };
};

const createPhaseHitbox = (startX, width, barY, phase, project) => ({
  x1: startX,
  x2: startX + width,
  y1: barY,
  y2: barY + GANTT_CONSTANTS.PHASE_BAR_HEIGHT,
  nome: phase.nome || '',
  percentuale: window.normalizePercent(phase.percentualeCompletamento),
  progetto: project.nome || '',
  dataInizio: phase.dataInizio || '',
  dataFine: phase.dataFine || '',
  stato: window.formatStato(phase.stato || 'in_corso'),
  milestone: !!phase.milestone
});

const drawMilestone = (ctx, phase, project, centerY, dateRange, unitConfig, dimensions, colors, baseColor) => {
  const fe = window.parseDateStr(phase.dataFine);
  if (!fe) return null;

  const { minDate } = dateRange;
  const { topMargin } = dimensions;
  const { offsetToX } = unitConfig;

  const milestoneOffset = window.diffInDays(minDate, fe);
  const milestoneX = offsetToX(milestoneOffset);
  const diamondSize = GANTT_CONSTANTS.PHASE_BAR_HEIGHT + GANTT_CONSTANTS.MILESTONE_SIZE_OFFSET;
  const half = diamondSize / 2;

  const oggi = window.parseDateStr(window.formatToday());
  const perc = window.normalizePercent(phase.percentualeCompletamento);
  const isLate = oggi && fe < oggi && perc < 100 && phase.stato !== 'completato';

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = isLate ? colors.lateStroke : window.shadeColor(baseColor, -45);
  ctx.lineWidth = 1.4;

  ctx.beginPath();
  ctx.moveTo(milestoneX, centerY - half);
  ctx.lineTo(milestoneX + half, centerY);
  ctx.lineTo(milestoneX, centerY + half);
  ctx.lineTo(milestoneX - half, centerY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = GANTT_CONSTANTS.FONT_MILESTONE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = window.shadeColor(baseColor, 40);
  ctx.fillText('MS', milestoneX, topMargin - 6);

  ctx.beginPath();
  ctx.moveTo(milestoneX, centerY - half);
  ctx.lineTo(milestoneX, topMargin);
  ctx.stroke();

  const hitbox = createPhaseHitbox(
    milestoneX - half - GANTT_CONSTANTS.TOOLTIP_EXTRA_MARGIN,
    (half * 2) + (GANTT_CONSTANTS.TOOLTIP_EXTRA_MARGIN * 2),
    centerY - half - GANTT_CONSTANTS.TOOLTIP_EXTRA_MARGIN,
    phase,
    project
  );
  hitbox.y2 = centerY + half + GANTT_CONSTANTS.TOOLTIP_EXTRA_MARGIN;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = GANTT_CONSTANTS.FONT_PHASE;

  return hitbox;
};

const drawPhaseBar = (ctx, phase, project, centerY, dateRange, unitConfig, colors, baseColor) => {
  const fs = window.parseDateStr(phase.dataInizio);
  const fe = window.parseDateStr(phase.dataFine);
  if (!fs || !fe) return null;

  const { minDate } = dateRange;
  const { offsetToX } = unitConfig;

  const startOffset = window.diffInDays(minDate, fs);
  const endOffset = window.diffInDays(minDate, fe) + 1;
  const startX = offsetToX(startOffset);
  const endX = offsetToX(endOffset);
  const width = Math.max(GANTT_CONSTANTS.MIN_BAR_WIDTH, endX - startX);

  const barY = centerY - GANTT_CONSTANTS.PHASE_BAR_HEIGHT / 2;
  const perc = window.normalizePercent(phase.percentualeCompletamento);
  
  const oggi = window.parseDateStr(window.formatToday());
  const isLate = oggi && fe < oggi && perc < 100 && phase.stato !== 'completato';

  const mappedColor = window.PHASE_COLOR_MAP[phase.nome];
  const faseColor = mappedColor || baseColor;

  ctx.fillStyle = faseColor;
  ctx.strokeStyle = isLate ? colors.lateStroke : window.shadeColor(faseColor, -40);
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.rect(startX, barY, width, GANTT_CONSTANTS.PHASE_BAR_HEIGHT);
  ctx.fill();
  ctx.stroke();

  if (isLate) {
    ctx.save();
    ctx.strokeStyle = colors.lateStroke;
    ctx.lineWidth = GANTT_CONSTANTS.STROKE_WIDTH_LATE;
    ctx.setLineDash(GANTT_CONSTANTS.DASH_PATTERN_LATE);
    ctx.strokeRect(startX, barY, width, GANTT_CONSTANTS.PHASE_BAR_HEIGHT);
    ctx.restore();
  }

  if (width > GANTT_CONSTANTS.TEXT_MIN_WIDTH) {
    drawPhaseText(ctx, phase, startX, barY, width, faseColor, perc);
  }

  return createPhaseHitbox(startX, width, barY, phase, project);
};

const drawPhaseText = (ctx, phase, startX, barY, width, faseColor, perc) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(startX + 1, barY, width - 2, GANTT_CONSTANTS.PHASE_BAR_HEIGHT);
  ctx.clip();

  const textColor = window.getContrastColor(faseColor);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const textMaxWidth = width - GANTT_CONSTANTS.TEXT_PADDING_HORIZONTAL;
  const baseLabel = phase.nome || '';
  const label = baseLabel !== '' ? `${baseLabel} (${perc}%)` : `${perc}%`;
  const text = window.fitText(ctx, label, textMaxWidth);
  
  if (text) {
    const r = parseInt(faseColor.slice(1, 3), 16) || 0;
    const g = parseInt(faseColor.slice(3, 5), 16) || 0;
    const b = parseInt(faseColor.slice(5, 7), 16) || 0;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b);

    ctx.strokeStyle = lum > 128 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(text, startX + GANTT_CONSTANTS.TEXT_PADDING, barY + GANTT_CONSTANTS.PHASE_BAR_HEIGHT / 2 + 0.5);
    ctx.fillText(text, startX + GANTT_CONSTANTS.TEXT_PADDING, barY + GANTT_CONSTANTS.PHASE_BAR_HEIGHT / 2 + 0.5);
  }

  ctx.restore();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
};

const drawPhases = (ctx, project, centerY, dateRange, unitConfig, dimensions, colors, hitData) => {
  if (!Array.isArray(project.fasi)) return;

  ctx.font = GANTT_CONSTANTS.FONT_PHASE;
  const baseColor = project.colore || '#9ca3af';

  project.fasi.forEach(phase => {
    let hitbox = null;

    if (phase.milestone) {
      hitbox = drawMilestone(ctx, phase, project, centerY, dateRange, unitConfig, dimensions, colors, baseColor);
    } else {
      hitbox = drawPhaseBar(ctx, phase, project, centerY, dateRange, unitConfig, colors, baseColor);
    }

    if (hitbox) {
      hitData.phases.push(hitbox);
    }
  });
};

const drawProjects = (ctx, projects, dateRange, unitConfig, dimensions, colors, hitData) => {
  projects.forEach((project, idx) => {
    const centerY = drawProjectLabel(ctx, project, idx, dimensions, colors);
    drawProjectBar(ctx, project, centerY, dateRange, unitConfig, colors);
    drawPhases(ctx, project, centerY, dateRange, unitConfig, dimensions, colors, hitData);
  });
};

window.drawGanttOnCanvas = function(canvas, projects, zoomLevel, hoverDataRef, theme) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const parentWidth = (canvas.parentElement?.clientWidth) || 900;
  const isDarkTheme = theme === 'dark';
  const colors = getThemeColors(isDarkTheme);

  const dimensions = calculateCanvasDimensions(projects, parentWidth);
  const { cssHeight, plotWidth, marginLeft } = dimensions;

  setupCanvas(canvas, parentWidth, cssHeight);

  const hitData = { phases: [], config: null };
  if (hoverDataRef) hoverDataRef.current = hitData;

  drawBackground(ctx, parentWidth, cssHeight, colors);

  if (projects.length === 0) {
    ctx.fillStyle = colors.emptyText;
    ctx.textAlign = 'center';
    ctx.font = GANTT_CONSTANTS.FONT_HEADER;
    ctx.textBaseline = 'middle';
    ctx.fillText('Nessun progetto da visualizzare. Inserisci nome utente e seleziona un reparto.', parentWidth / 2, cssHeight / 2);
    return;
  }

  const dateRange = calculateDateRange(projects);
  if (!dateRange) {
    ctx.fillStyle = colors.emptyText;
    ctx.textAlign = 'center';
    ctx.font = GANTT_CONSTANTS.FONT_HEADER;
    ctx.textBaseline = 'middle';
    ctx.fillText('Non è stato possibile calcolare l\'intervallo di date.', parentWidth / 2, cssHeight / 2);
    return;
  }

  const unitSize = getUnitSize(zoomLevel);
  const totalUnits = Math.max(1, Math.ceil(dateRange.totalDays / unitSize));
  const unitWidth = plotWidth / totalUnits;

  const unitConfig = {
    unitSize,
    unitWidth,
    offsetToX: (offsetDays) => marginLeft + (offsetDays / unitSize) * unitWidth
  };

  hitData.config = {
    minDate: dateRange.minDate,
    maxDate: dateRange.maxDate,
    marginLeft,
    plotWidth,
    unitSize,
    unitWidth,
    topMargin: dimensions.topMargin,
    bottomMargin: dimensions.bottomMargin,
    cssHeight
  };

  ctx.font = GANTT_CONSTANTS.FONT_HEADER;
  ctx.textBaseline = 'middle';

  drawMonthHeaders(ctx, dateRange, dimensions, unitConfig, colors);
  drawDayGrid(ctx, dateRange, dimensions, unitConfig, colors, zoomLevel);
  drawBottomAxis(ctx, dimensions, colors);
  drawTodayLine(ctx, dateRange, dimensions, unitConfig, colors);
  drawProjects(ctx, projects, dateRange, unitConfig, dimensions, colors, hitData);
};
