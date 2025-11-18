// utils-logic.js - Funzioni logiche e di validazione

window.normalizePercent = function(val) {
  let n = typeof val === 'number' ? val : Number(val || 0);
  if (isNaN(n)) n = 0;
  return Math.max(0, Math.min(100, n));
};

window.snapPercentToPreset = function(value) {
  const v = window.normalizePercent(value);
  let best = window.PERCENT_PRESETS[0];
  let minDiff = Infinity;
  for (let preset of window.PERCENT_PRESETS) {
    const diff = Math.abs(preset - v);
    if (diff < minDiff) {
      minDiff = diff;
      best = preset;
    }
  }
  return best;
};

window.getPercentClass = function(percent) {
  const n = window.normalizePercent(percent);
  if (n < 25) return 'percent-low';
  if (n < 50) return 'percent-midlow';
  if (n < 75) return 'percent-midhigh';
  if (n < 100) return 'percent-azure';
  return 'percent-high';
};

window.formatStato = function(stato) {
  return window.STATUS_LABELS[stato] || stato || '';
};

window.computeEasterSunday = function(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

window.isItalianHoliday = function(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const key = `${mm}-${dd}`;
  if (window.ITALIAN_HOLIDAYS_FIXED.includes(key)) return true;

  const year = date.getFullYear();
  const easter = window.computeEasterSunday(year);
  const easterMonday = window.addDays(easter, 1);
  return window.isSameDate(date, easter) || window.isSameDate(date, easterMonday);
};

window.isItemLate = function(item) {
  const today = window.parseDateStr(window.formatToday());
  const end = window.parseDateStr(item.dataFine);
  if (!today || !end) return false;
  const perc = window.normalizePercent(item.percentualeCompletamento);
  if (item.stato === 'completato' || perc >= 100) return false;
  return end < today;
};

window.ensureProjectIds = function(list) {
  if (!Array.isArray(list)) return [];
  return list.map(p => {
    const projectId = p.id || window.createId('project');
    const fasi = Array.isArray(p.fasi)
      ? p.fasi.map(f => ({ ...f, id: f.id || window.createId('phase') }))
      : [];
    return { ...p, id: projectId, fasi };
  });
};

window.filterDepartments = function(list) {
  if (!Array.isArray(list)) return [window.CONFIG.DEFAULT_DEPARTMENT];
  const filtered = list.filter(dep => {
    if (dep === window.CONFIG.DEFAULT_DEPARTMENT) return false;
    if (typeof dep === 'string' && dep.toLowerCase() === 'generale') return false;
    return true;
  });
  return [window.CONFIG.DEFAULT_DEPARTMENT, ...filtered];
};

window.calcolaPercentProgettoDaFasi = function(fasi) {
  if (!Array.isArray(fasi) || fasi.length === 0) return 0;
  let sum = 0;
  fasi.forEach(f => {
    sum += window.normalizePercent(f.percentualeCompletamento);
  });
  return Math.round(sum / fasi.length);
};

window.calcolaEstremiDate = function(projects) {
  let minDate = null;
  let maxDate = null;

  projects.forEach(p => {
    const s = window.parseDateStr(p.dataInizio);
    const e = window.parseDateStr(p.dataFine);
    if (s && (!minDate || s < minDate)) minDate = s;
    if (e && (!maxDate || e > maxDate)) maxDate = e;

    if (Array.isArray(p.fasi)) {
      p.fasi.forEach(f => {
        const fs = window.parseDateStr(f.dataInizio);
        const fe = window.parseDateStr(f.dataFine);
        if (fs && (!minDate || fs < minDate)) minDate = fs;
        if (fe && (!maxDate || fe > maxDate)) maxDate = fe;
      });
    }
  });

  if (!minDate || !maxDate) return null;
  return { minDate, maxDate };
};

window.applyAutomaticStatusRules = function(projects) {
  const today = window.parseDateStr(window.formatToday());
  if (!today) return { projectsWithAuto: projects, anomalies: [] };

  const projectsWithAuto = projects.map(p => ({
    ...p,
    fasi: Array.isArray(p.fasi) ? p.fasi.map(f => ({ ...f })) : []
  }));

  const anomalies = [];

  projectsWithAuto.forEach(project => {
    const start = window.parseDateStr(project.dataInizio);
    const end = window.parseDateStr(project.dataFine);
    let percProj = window.normalizePercent(project.percentualeCompletamento);

    if (percProj >= 100 || project.stato === 'completato') {
      if (project.stato !== 'completato' || percProj !== 100) {
        anomalies.push({
          type: 'progetto_auto_completato',
          projectName: project.nome || 'Progetto senza nome'
        });
      }
      project.stato = 'completato';
      project.percentualeCompletamento = 100;
      percProj = 100;
    }

    if (start && today > start && project.stato !== 'in_corso' && project.stato !== 'completato') {
      anomalies.push({
        type: 'progetto_in_ritardo_partenza',
        projectName: project.nome || 'Progetto senza nome'
      });
      project.stato = 'in_ritardo';
    }

    if (end && today > end && project.stato !== 'completato' && percProj < 100) {
      anomalies.push({
        type: 'progetto_in_ritardo_fine',
        projectName: project.nome || 'Progetto senza nome'
      });
      project.stato = 'in_ritardo';
    }

    if (Array.isArray(project.fasi)) {
      project.fasi.forEach(phase => {
        const fs = window.parseDateStr(phase.dataInizio);
        const fe = window.parseDateStr(phase.dataFine);
        let percPhase = window.normalizePercent(phase.percentualeCompletamento);

        if (percPhase >= 100 || phase.stato === 'completato') {
          if (phase.stato !== 'completato' || percPhase !== 100) {
            anomalies.push({
              type: 'fase_auto_completata',
              projectName: project.nome || 'Progetto senza nome',
              phaseName: phase.nome || 'Fase'
            });
          }
          phase.stato = 'completato';
          phase.percentualeCompletamento = 100;
          percPhase = 100;
        }

        if (fs && today > fs && phase.stato !== 'in_corso' && phase.stato !== 'completato') {
          anomalies.push({
            type: 'fase_in_ritardo_partenza',
            projectName: project.nome || 'Progetto senza nome',
            phaseName: phase.nome || 'Fase'
          });
          phase.stato = 'in_ritardo';
        }

        if (fe && today > fe && phase.stato !== 'completato' && percPhase < 100) {
          anomalies.push({
            type: 'fase_in_ritardo_fine',
            projectName: project.nome || 'Progetto senza nome',
            phaseName: phase.nome || 'Fase'
          });
          phase.stato = 'in_ritardo';
        }

        if (fs && window.isItalianHoliday(fs)) {
          anomalies.push({
            type: 'fase_in_festivo_inizio',
            projectName: project.nome || 'Progetto senza nome',
            phaseName: phase.nome || 'Fase'
          });
        }

        if (fe && window.isItalianHoliday(fe)) {
          anomalies.push({
            type: 'fase_in_festivo_fine',
            projectName: project.nome || 'Progetto senza nome',
            phaseName: phase.nome || 'Fase'
          });
        }
      });
    }
  });

  return { projectsWithAuto, anomalies };
};