const percentCache = new Map();
const MAX_CACHE_SIZE = 1000;

window.normalizePercent = function(val) {
  const key = String(val);
  
  if (percentCache.has(key)) {
    return percentCache.get(key);
  }

  let n = typeof val === 'number' ? val : Number(val || 0);
  if (isNaN(n)) n = 0;
  const result = Math.max(0, Math.min(100, n));

  if (percentCache.size >= MAX_CACHE_SIZE) {
    const firstKey = percentCache.keys().next().value;
    percentCache.delete(firstKey);
  }
  percentCache.set(key, result);

  return result;
};

window.snapPercentToPreset = function(value) {
  const v = window.normalizePercent(value);
  const presets = window.PERCENT_PRESETS;
  
  let best = presets[0];
  let minDiff = Math.abs(presets[0] - v);
  
  for (let i = 1; i < presets.length; i++) {
    const diff = Math.abs(presets[i] - v);
    if (diff < minDiff) {
      minDiff = diff;
      best = presets[i];
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

const easterCache = new Map();

window.computeEasterSunday = function(year) {
  if (easterCache.has(year)) {
    return new Date(easterCache.get(year));
  }

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
  
  const result = new Date(year, month - 1, day);
  easterCache.set(year, result.getTime());
  
  return new Date(result);
};

const holidayCache = new Map();

window.isItalianHoliday = function(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  
  if (holidayCache.has(dateKey)) {
    return holidayCache.get(dateKey);
  }

  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const key = `${mm}-${dd}`;
  
  if (window.ITALIAN_HOLIDAYS_FIXED.includes(key)) {
    holidayCache.set(dateKey, true);
    return true;
  }

  const year = date.getFullYear();
  const easter = window.computeEasterSunday(year);
  const easterMonday = window.addDays(easter, 1);
  const isHoliday = window.isSameDate(date, easter) || window.isSameDate(date, easterMonday);
  
  holidayCache.set(dateKey, isHoliday);
  return isHoliday;
};

window.isItemLate = function(item) {
  if (!item || typeof item !== 'object') return false;

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
    if (!p || typeof p !== 'object') return null;
    
    const projectId = p.id || window.createId('project');
    const fasi = Array.isArray(p.fasi)
      ? p.fasi.map(f => {
          if (!f || typeof f !== 'object') return null;
          return { ...f, id: f.id || window.createId('phase') };
        }).filter(Boolean)
      : [];
    
    return { ...p, id: projectId, fasi };
  }).filter(Boolean);
};

window.filterDepartments = function(list) {
  if (!Array.isArray(list)) return [window.CONFIG.DEFAULT_DEPARTMENT];
  
  const defaultDep = window.CONFIG.DEFAULT_DEPARTMENT;
  const filtered = list.filter(dep => {
    if (dep === defaultDep) return false;
    if (typeof dep === 'string' && dep.toLowerCase() === 'generale') return false;
    return true;
  });
  
  return [defaultDep, ...filtered];
};

window.calcolaPercentProgettoDaFasi = function(fasi) {
  if (!Array.isArray(fasi) || fasi.length === 0) return 0;
  
  const sum = fasi.reduce((acc, f) => {
    if (!f || typeof f !== 'object') return acc;
    return acc + window.normalizePercent(f.percentualeCompletamento);
  }, 0);
  
  return Math.round(sum / fasi.length);
};

window.calcolaEstremiDate = function(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return null;

  let minDate = null;
  let maxDate = null;

  projects.forEach(p => {
    if (!p || typeof p !== 'object') return;

    const s = window.parseDateStr(p.dataInizio);
    const e = window.parseDateStr(p.dataFine);
    
    if (s && (!minDate || s < minDate)) minDate = s;
    if (e && (!maxDate || e > maxDate)) maxDate = e;

    if (Array.isArray(p.fasi)) {
      p.fasi.forEach(f => {
        if (!f || typeof f !== 'object') return;
        
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

const createAnomaly = (type, projectName, phaseName = null) => {
  const anomaly = { type, projectName };
  if (phaseName) anomaly.phaseName = phaseName;
  return anomaly;
};

const processProjectStatus = (project, today, anomalies) => {
  const start = window.parseDateStr(project.dataInizio);
  const end = window.parseDateStr(project.dataFine);
  let percProj = window.normalizePercent(project.percentualeCompletamento);

  if (percProj >= 100 || project.stato === 'completato') {
    if (project.stato !== 'completato' || percProj !== 100) {
      anomalies.push(createAnomaly('progetto_auto_completato', project.nome || 'Progetto senza nome'));
    }
    project.stato = 'completato';
    project.percentualeCompletamento = 100;
    return;
  }

  if (start && today > start && project.stato !== 'in_corso' && project.stato !== 'completato') {
    anomalies.push(createAnomaly('progetto_in_ritardo_partenza', project.nome || 'Progetto senza nome'));
    project.stato = 'in_ritardo';
  }

  if (end && today > end && project.stato !== 'completato' && percProj < 100) {
    anomalies.push(createAnomaly('progetto_in_ritardo_fine', project.nome || 'Progetto senza nome'));
    project.stato = 'in_ritardo';
  }
};

const processPhaseStatus = (phase, project, today, anomalies) => {
  const fs = window.parseDateStr(phase.dataInizio);
  const fe = window.parseDateStr(phase.dataFine);
  let percPhase = window.normalizePercent(phase.percentualeCompletamento);

  const projectName = project.nome || 'Progetto senza nome';
  const phaseName = phase.nome || 'Fase';

  if (percPhase >= 100 || phase.stato === 'completato') {
    if (phase.stato !== 'completato' || percPhase !== 100) {
      anomalies.push(createAnomaly('fase_auto_completata', projectName, phaseName));
    }
    phase.stato = 'completato';
    phase.percentualeCompletamento = 100;
    return;
  }

  if (fs && today > fs && phase.stato !== 'in_corso' && phase.stato !== 'completato') {
    anomalies.push(createAnomaly('fase_in_ritardo_partenza', projectName, phaseName));
    phase.stato = 'in_ritardo';
  }

  if (fe && today > fe && phase.stato !== 'completato' && percPhase < 100) {
    anomalies.push(createAnomaly('fase_in_ritardo_fine', projectName, phaseName));
    phase.stato = 'in_ritardo';
  }

  if (fs && window.isItalianHoliday(fs)) {
    anomalies.push(createAnomaly('fase_in_festivo_inizio', projectName, phaseName));
  }

  if (fe && window.isItalianHoliday(fe)) {
    anomalies.push(createAnomaly('fase_in_festivo_fine', projectName, phaseName));
  }
};

window.applyAutomaticStatusRules = function(projects) {
  if (!Array.isArray(projects)) {
    return { projectsWithAuto: [], anomalies: [] };
  }

  const today = window.parseDateStr(window.formatToday());
  if (!today) {
    return { projectsWithAuto: projects, anomalies: [] };
  }

  const projectsWithAuto = projects.map(p => {
    if (!p || typeof p !== 'object') return null;
    
    return {
      ...p,
      fasi: Array.isArray(p.fasi) 
        ? p.fasi.map(f => f && typeof f === 'object' ? { ...f } : null).filter(Boolean)
        : []
    };
  }).filter(Boolean);

  const anomalies = [];

  projectsWithAuto.forEach(project => {
    processProjectStatus(project, today, anomalies);

    if (Array.isArray(project.fasi)) {
      project.fasi.forEach(phase => {
        if (phase && typeof phase === 'object') {
          processPhaseStatus(phase, project, today, anomalies);
        }
      });
    }
  });

  return { projectsWithAuto, anomalies };
};
