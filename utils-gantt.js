// utils-gantt.js - Funzioni per disegnare il diagramma di Gantt

window.shadeColor = function(color, amount) {
  if (!color || color[0] !== '#') return color;
  let col = color.slice(1);
  if (col.length === 3) {
    col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2];
  }
  let num = parseInt(col, 16);
  if (isNaN(num)) return color;
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 255) + amount;
  let b = (num & 255) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
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

window.drawGanttOnCanvas = function(canvas, projects, zoomLevel, hoverDataRef, theme) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const parentWidth = (canvas.parentElement?.clientWidth) || 900;
  const isDarkTheme = theme === 'dark';

  const colors = {
    background: isDarkTheme ? '#020617' : '#ffffff',
    headerText: isDarkTheme ? '#e5e7eb' : '#374151',
    gridStrong: isDarkTheme ? '#4b5563' : '#9ca3af',
    gridLight: isDarkTheme ? '#1f2937' : '#e5e7eb',
    bottomAxis: isDarkTheme ? '#4b5563' : '#d1d5db',
    labelText: isDarkTheme ? '#e5e7eb' : '#374151',
    dayText: isDarkTheme ? '#9ca3af' : '#6b7280',
    emptyText: isDarkTheme ? '#6b7280' : '#9ca3af'
  };

  const { CANVAS_ROW_HEIGHT, CANVAS_TOP_MARGIN, CANVAS_BOTTOM_MARGIN, CANVAS_MIN_HEIGHT, CANVAS_LEFT_MARGIN, CANVAS_RIGHT_MARGIN } = window.CONFIG;

  const totalRows = Math.max(1, projects.length);
  const cssHeight = Math.max(CANVAS_MIN_HEIGHT, CANVAS_TOP_MARGIN + CANVAS_BOTTOM_MARGIN + CANVAS_ROW_HEIGHT * totalRows);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = parentWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = '100%';
  canvas.style.height = `${cssHeight}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, parentWidth, cssHeight);

  ctx.font = "600 13px 'Inter', system-ui, sans-serif";
  ctx.textBaseline = 'middle';

  const hitData = { phases: [], config: null };
  if (hoverDataRef) hoverDataRef.current = hitData;

  if (projects.length === 0) {
    ctx.fillStyle = colors.emptyText;
    ctx.textAlign = 'center';
    ctx.fillText('Nessun progetto da visualizzare. Inserisci nome utente e seleziona un reparto.', parentWidth / 2, cssHeight / 2);
    return;
  }

  const bounds = window.calcolaEstremiDate(projects);
  if (!bounds) {
    ctx.fillStyle = colors.emptyText;
    ctx.textAlign = 'center';
    ctx.fillText('Non è stato possibile calcolare l\'intervallo di date.', parentWidth / 2, cssHeight / 2);
    return;
  }

  const originalMinDate = bounds.minDate;
  const originalMaxDate = bounds.maxDate;
  const minDate = window.addDays(originalMinDate, -3);
  const maxDate = window.addDays(originalMaxDate, 3);
  let totalDays = window.diffInDays(minDate, maxDate) + 1;
  if (totalDays <= 0) totalDays = 1;

  const plotWidth = Math.max(80, parentWidth - CANVAS_LEFT_MARGIN - CANVAS_RIGHT_MARGIN);
  const projectBarHeight = 26;
  const phaseBarHeight = 20;

  let unitSize;
  switch (zoomLevel) {
    case window.ZOOM_LEVELS.WEEKS: unitSize = 7; break;
    case window.ZOOM_LEVELS.MONTHS: unitSize = 30; break;
    default: unitSize = 1; break;
  }

  const totalUnits = Math.max(1, Math.ceil(totalDays / unitSize));
  const unitWidth = plotWidth / totalUnits;

  function offsetToX(offsetDays) {
    return CANVAS_LEFT_MARGIN + (offsetDays / unitSize) * unitWidth;
  }

  hitData.config = {
    minDate,
    maxDate,
    marginLeft: CANVAS_LEFT_MARGIN,
    plotWidth,
    unitSize,
    unitWidth,
    topMargin: CANVAS_TOP_MARGIN,
    bottomMargin: CANVAS_BOTTOM_MARGIN,
    cssHeight
  };

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, parentWidth, cssHeight);

  ctx.fillStyle = colors.headerText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = "11px 'Inter', system-ui, sans-serif";

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

      const label = `${window.MONTHS[m]} ${year}`;
      ctx.fillText(label, xCenter, CANVAS_TOP_MARGIN - 24);

      ctx.beginPath();
      ctx.moveTo(xStart + 0.5, CANVAS_TOP_MARGIN - 4);
      ctx.lineTo(xStart + 0.5, cssHeight - CANVAS_BOTTOM_MARGIN + 4);
      ctx.stroke();
    }
  }

  if (zoomLevel !== window.ZOOM_LEVELS.MONTHS) {
    ctx.strokeStyle = colors.gridLight;
    ctx.lineWidth = 1;
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = 'center';

    for (let d = new Date(minDate.getTime()); d <= maxDate; d = window.addDays(d, 1)) {
      if (zoomLevel === window.ZOOM_LEVELS.WEEKS && d.getDay() !== 1) continue;

      const offset = window.diffInDays(minDate, d);
      const x = offsetToX(offset);

      ctx.beginPath();
      ctx.moveTo(x + 0.5, CANVAS_TOP_MARGIN);
      ctx.lineTo(x + 0.5, cssHeight - CANVAS_BOTTOM_MARGIN + 10);
      ctx.stroke();

      const dayNumber = String(d.getDate());
      const letter = window.DAY_LETTERS[d.getDay()] || '';

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = colors.dayText;
      ctx.fillText(dayNumber, x, cssHeight - CANVAS_BOTTOM_MARGIN + 14);
      ctx.fillText(letter, x, cssHeight - CANVAS_BOTTOM_MARGIN + 28);
    }
  }

  ctx.strokeStyle = colors.bottomAxis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CANVAS_LEFT_MARGIN, cssHeight - CANVAS_BOTTOM_MARGIN);
  ctx.lineTo(CANVAS_LEFT_MARGIN + plotWidth, cssHeight - CANVAS_BOTTOM_MARGIN);
  ctx.stroke();

  const oggi = window.parseDateStr(window.formatToday());
  if (oggi && oggi >= minDate && oggi <= maxDate) {
    const offsetOggi = window.diffInDays(minDate, oggi);
    const xOggi = offsetToX(offsetOggi) + 0.5;
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xOggi, CANVAS_TOP_MARGIN);
    ctx.lineTo(xOggi, cssHeight - CANVAS_BOTTOM_MARGIN + 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillText('Oggi', xOggi, CANVAS_TOP_MARGIN - 40);
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = "600 13px 'Inter', system-ui, sans-serif";

  projects.forEach((p, idx) => {
    ctx.font = "600 13px 'Inter', system-ui, sans-serif";

    const rowTop = CANVAS_TOP_MARGIN + idx * CANVAS_ROW_HEIGHT;
    const centerY = rowTop + CANVAS_ROW_HEIGHT / 2;

    ctx.fillStyle = colors.labelText;
    const nome = p.nome || `Progetto ${idx + 1}`;
    const labelMaxWidth = CANVAS_LEFT_MARGIN - 18;
    let labelText = nome;
    while (ctx.measureText(labelText).width > labelMaxWidth && labelText.length > 0) {
      labelText = labelText.slice(0, -1);
    }
    if (labelText !== nome) labelText = labelText.slice(0, -1) + '…';
    ctx.fillText(labelText, CANVAS_LEFT_MARGIN - 12, centerY);

    const s = window.parseDateStr(p.dataInizio);
    const e = window.parseDateStr(p.dataFine);
    if (s && e) {
      const startOffset = window.diffInDays(minDate, s);
      const endOffset = window.diffInDays(minDate, e) + 1;
      let startX = offsetToX(startOffset);
      let endX = offsetToX(endOffset);
      let width = Math.max(3, endX - startX);

      ctx.fillStyle = p.colore || '#9ca3af';
      ctx.strokeStyle = window.shadeColor(p.colore || '#9ca3af', -40);
      ctx.lineWidth = 1;

      const barY = centerY - projectBarHeight / 2;
      ctx.beginPath();
      ctx.rect(startX, barY, width, projectBarHeight);
      ctx.fill();
      ctx.stroke();

      const percProj = window.normalizePercent(p.percentualeCompletamento);
      const projLate = oggi && e < oggi && percProj < 100 && p.stato !== 'completato';
      if (projLate) {
        ctx.save();
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(startX, barY, width, projectBarHeight);
        ctx.restore();
      }
    }

    if (Array.isArray(p.fasi)) {
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      const baseColor = p.colore || '#9ca3af';

      p.fasi.forEach(f => {
        const fs = window.parseDateStr(f.dataInizio);
        const fe = window.parseDateStr(f.dataFine);
        if (!fs || !fe) return;

        const startOffset = window.diffInDays(minDate, fs);
        const endOffset = window.diffInDays(minDate, fe) + 1;
        let startX = offsetToX(startOffset);
        let endX = offsetToX(endOffset);
        let width = Math.max(3, endX - startX);

        const barY = centerY - phaseBarHeight / 2;
        const perc = window.normalizePercent(f.percentualeCompletamento);
        const isLate = oggi && fe < oggi && perc < 100 && f.stato !== 'completato';

        const phaseHit = {
          x1: startX,
          x2: startX + width,
          y1: barY,
          y2: barY + phaseBarHeight,
          nome: f.nome || '',
          percentuale: perc,
          progetto: p.nome || '',
          dataInizio: f.dataInizio || '',
          dataFine: f.dataFine || '',
          stato: window.formatStato(f.stato || 'in_corso'),
          milestone: !!f.milestone
        };

        if (f.milestone) {
          const milestoneOffset = window.diffInDays(minDate, fe);
          const milestoneX = offsetToX(milestoneOffset);
          const diamondSize = phaseBarHeight + 4;
          const half = diamondSize / 2;

          ctx.fillStyle = '#000000';
          ctx.strokeStyle = isLate ? 'rgba(220, 38, 38, 0.95)' : window.shadeColor(baseColor, -45);
          ctx.lineWidth = 1.4;

          ctx.beginPath();
          ctx.moveTo(milestoneX, centerY - half);
          ctx.lineTo(milestoneX + half, centerY);
          ctx.lineTo(milestoneX, centerY + half);
          ctx.lineTo(milestoneX - half, centerY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = window.shadeColor(baseColor, 40);
          ctx.fillText('MS', milestoneX, CANVAS_TOP_MARGIN - 6);

          ctx.beginPath();
          ctx.moveTo(milestoneX, centerY - half);
          ctx.lineTo(milestoneX, CANVAS_TOP_MARGIN);
          ctx.stroke();

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.font = "10px 'Inter', system-ui, sans-serif";

          phaseHit.x1 = milestoneX - half - 4;
          phaseHit.x2 = milestoneX + half + 4;
          phaseHit.y1 = centerY - half - 4;
          phaseHit.y2 = centerY + half + 4;

          hitData.phases.push(phaseHit);
          return;
        }

        const mappedColor = window.PHASE_COLOR_MAP[f.nome];
        const faseColor = mappedColor || baseColor;

        ctx.fillStyle = faseColor;
        ctx.strokeStyle = isLate ? 'rgba(220, 38, 38, 0.95)' : window.shadeColor(faseColor, -40);
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.rect(startX, barY, width, phaseBarHeight);
        ctx.fill();
        ctx.stroke();

        if (isLate) {
          ctx.save();
          ctx.strokeStyle = 'rgba(220, 38, 38, 0.95)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(startX, barY, width, phaseBarHeight);
          ctx.restore();
        }

        if (width > 22) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(startX + 1, barY, width - 2, phaseBarHeight);
          ctx.clip();

          const textColor = window.getContrastColor(faseColor);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          const textMaxWidth = width - 8;
          const baseLabel = f.nome || '';
          const label = baseLabel !== '' ? `${baseLabel} (${perc}%)` : `${perc}%`;
          const text = window.fitText(ctx, label, textMaxWidth);
          if (text) {
            const r = parseInt(faseColor.slice(1, 3), 16) || 0;
            const g = parseInt(faseColor.slice(3, 5), 16) || 0;
            const b = parseInt(faseColor.slice(5, 7), 16) || 0;
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);

            ctx.strokeStyle = lum > 128 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(text, startX + 4, barY + phaseBarHeight / 2 + 0.5);
            ctx.fillText(text, startX + 4, barY + phaseBarHeight / 2 + 0.5);
          }

          ctx.restore();
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
        }

        hitData.phases.push(phaseHit);
      });
    }
  });
};