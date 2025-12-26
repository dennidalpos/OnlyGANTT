(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const config = window.AppConfig;
  const VALID_STATES = config.states;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const dateUtils = window.OnlyGantt.dateUtils;

  function calculateProjectPercentage(project) {
    if (project.percentualeCompletamento !== null && typeof project.percentualeCompletamento === 'number') {
      return project.percentualeCompletamento;
    }

    if (!Array.isArray(project.fasi) || project.fasi.length === 0) {
      return 0;
    }

    const sum = project.fasi.reduce((acc, fase) => acc + (fase.percentualeCompletamento || 0), 0);
    return Math.round(sum / project.fasi.length);
  }

  function isValidDateString(value) {
    if (!value || typeof value !== 'string') return false;
    const parsed = dateUtils.parseDate(value);
    return !!parsed;
  }

  function isValidUUID(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
  }

  function isDelayed(item) {
    if (!item.dataFine) return false;
    if (item.stato === 'completato') return false;

    const today = new Date();
    const endDate = dateUtils.parseDate(item.dataFine);
    if (!endDate) return false;

    return dateUtils.compareDates(endDate, today) < 0;
  }

  function isPhaseOutsideProjectRange(phase, project) {
    if (!phase.dataInizio && !phase.dataFine) return false;
    if (!project.dataInizio && !project.dataFine) return false;

    const phaseStart = phase.dataInizio ? dateUtils.parseDate(phase.dataInizio) : null;
    const phaseEnd = phase.dataFine ? dateUtils.parseDate(phase.dataFine) : null;
    const projectStart = project.dataInizio ? dateUtils.parseDate(project.dataInizio) : null;
    const projectEnd = project.dataFine ? dateUtils.parseDate(project.dataFine) : null;

    if (phaseStart && projectStart && dateUtils.compareDates(phaseStart, projectStart) < 0) {
      return true;
    }

    if (phaseEnd && projectEnd && dateUtils.compareDates(phaseEnd, projectEnd) > 0) {
      return true;
    }

    return false;
  }

  function isMilestoneOutsideProject(phase, project) {
    if (!phase.milestone) return false;
    if (!phase.dataFine) return false;
    if (!project.dataInizio && !project.dataFine) return false;

    const milestoneDate = dateUtils.parseDate(phase.dataFine);
    const projectStart = project.dataInizio ? dateUtils.parseDate(project.dataInizio) : null;
    const projectEnd = project.dataFine ? dateUtils.parseDate(project.dataFine) : null;

    if (projectStart && dateUtils.compareDates(milestoneDate, projectStart) < 0) {
      return true;
    }

    if (projectEnd && dateUtils.compareDates(milestoneDate, projectEnd) > 0) {
      return true;
    }

    return false;
  }

  function isPhaseOnHoliday(phase) {
    if (!phase.dataInizio || !phase.dataFine) return false;
    if (phase.includeFestivi) return false;

    const start = dateUtils.parseDate(phase.dataInizio);
    const end = dateUtils.parseDate(phase.dataFine);
    if (!start || !end) return false;

    const dates = dateUtils.getDateRange(start, end);
    return dates.some(date => dateUtils.isItalianHoliday(date) || dateUtils.isWeekend(date));
  }

  function hasPercentage100NotCompleted(item) {
    const percentage = item.percentualeCompletamento;
    if (percentage !== 100) return false;
    return item.stato !== 'completato';
  }

  function autoFixPercentage100(item) {
    if (!config.logic.enableAutoFixPercent100ToCompleted) return false;
    if (!hasPercentage100NotCompleted(item)) return false;

    item.stato = 'completato';
    return true;
  }

  function getProjectAlerts(project) {
    const alerts = {
      projectDelayed: false,
      phasesDelayed: [],
      phasesOutsideRange: [],
      milestonesOutsideRange: [],
      phasesOnHoliday: [],
      phasesMissingDates: [],
      noPhases: false,
      projectMissingDates: false,
      percentage100NotCompleted: false
    };

    if (isDelayed(project)) {
      alerts.projectDelayed = true;
    }

    if (!project.dataInizio || !project.dataFine) {
      alerts.projectMissingDates = true;
    }

    if (!Array.isArray(project.fasi) || project.fasi.length === 0) {
      alerts.noPhases = true;
    }

    const projectPercentage = calculateProjectPercentage(project);
    if (projectPercentage === 100 && project.stato !== 'completato') {
      alerts.percentage100NotCompleted = true;
    }

    if (Array.isArray(project.fasi)) {
      project.fasi.forEach(fase => {
        if (isDelayed(fase)) {
          alerts.phasesDelayed.push(fase);
        }

        if (isPhaseOutsideProjectRange(fase, project)) {
          alerts.phasesOutsideRange.push(fase);
        }

        if (fase.milestone && isMilestoneOutsideProject(fase, project)) {
          alerts.milestonesOutsideRange.push(fase);
        }

        if (isPhaseOnHoliday(fase)) {
          alerts.phasesOnHoliday.push(fase);
        }

        if (!fase.dataInizio || !fase.dataFine) {
          alerts.phasesMissingDates.push(fase);
        }
      });
    }

    return alerts;
  }

  function getProjectAlertSeverity(alerts) {
    if (!alerts) return null;

    const hasError = Boolean(
      alerts.projectDelayed ||
      alerts.phasesDelayed.length ||
      alerts.phasesOutsideRange.length ||
      alerts.milestonesOutsideRange.length ||
      alerts.percentage100NotCompleted
    );

    if (hasError) return 'error';

    const hasWarning = Boolean(
      alerts.projectMissingDates ||
      alerts.noPhases ||
      alerts.phasesMissingDates.length
    );

    if (hasWarning) return 'warning';

    const hasInfo = Boolean(alerts.phasesOnHoliday.length);

    if (hasInfo) return 'info';

    return null;
  }

  function normalizePhase(phase, projectIndex, phaseIndex, errors) {
    const safePhase = (phase && typeof phase === 'object') ? { ...phase } : {};

    if (!phase || typeof phase !== 'object') {
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1} non valida`);
    }

    if (!safePhase.id || !isValidUUID(safePhase.id)) {
      safePhase.id = generateUUID();
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: id non valido`);
    }

    if (!safePhase.nome || typeof safePhase.nome !== 'string' || !safePhase.nome.trim()) {
      safePhase.nome = `Fase ${phaseIndex + 1}`;
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: nome mancante`);
    }

    if (safePhase.colore !== null && typeof safePhase.colore !== 'string') {
      safePhase.colore = getPhaseColor(safePhase.nome);
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: colore non valido`);
    }

    if (!VALID_STATES.includes(safePhase.stato)) {
      safePhase.stato = 'da_iniziare';
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: stato non valido`);
    }

    if (safePhase.percentualeCompletamento !== null) {
      if (typeof safePhase.percentualeCompletamento !== 'number' ||
          safePhase.percentualeCompletamento < 0 ||
          safePhase.percentualeCompletamento > 100) {
        safePhase.percentualeCompletamento = null;
        errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: completamento non valido`);
      }
    }

    if (!Object.prototype.hasOwnProperty.call(safePhase, 'milestone') || typeof safePhase.milestone !== 'boolean') {
      safePhase.milestone = false;
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: milestone non valido`);
    }

    if (!Object.prototype.hasOwnProperty.call(safePhase, 'includeFestivi') || typeof safePhase.includeFestivi !== 'boolean') {
      safePhase.includeFestivi = false;
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: includeFestivi non valido`);
    }

    if (safePhase.note !== undefined && typeof safePhase.note !== 'string') {
      safePhase.note = '';
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: note non valide`);
    }

    if (safePhase.dataInizio && !isValidDateString(safePhase.dataInizio)) {
      safePhase.dataInizio = null;
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: data inizio non valida`);
    }

    if (safePhase.dataFine && !isValidDateString(safePhase.dataFine)) {
      safePhase.dataFine = null;
      errors.push(`Fase ${projectIndex + 1}.${phaseIndex + 1}: data fine non valida`);
    }

    return safePhase;
  }

  function normalizeProject(project, index, errors) {
    const safeProject = (project && typeof project === 'object') ? { ...project } : createNewProject();

    if (!project || typeof project !== 'object') {
      errors.push(`Progetto ${index + 1} non valido`);
    }

    if (!safeProject.id || !isValidUUID(safeProject.id)) {
      safeProject.id = generateUUID();
      errors.push(`Progetto ${index + 1}: id non valido`);
    }

    if (!safeProject.nome || typeof safeProject.nome !== 'string' || !safeProject.nome.trim()) {
      safeProject.nome = `Progetto ${index + 1}`;
      errors.push(`Progetto ${index + 1}: nome mancante`);
    }

    if (!safeProject.colore || typeof safeProject.colore !== 'string') {
      safeProject.colore = '#3b82f6';
      errors.push(`Progetto ${index + 1}: colore non valido`);
    }

    if (!VALID_STATES.includes(safeProject.stato)) {
      safeProject.stato = 'da_iniziare';
      errors.push(`Progetto ${index + 1}: stato non valido`);
    }

    if (safeProject.percentualeCompletamento !== null) {
      if (typeof safeProject.percentualeCompletamento !== 'number' ||
          safeProject.percentualeCompletamento < 0 ||
          safeProject.percentualeCompletamento > 100) {
        safeProject.percentualeCompletamento = null;
        errors.push(`Progetto ${index + 1}: completamento non valido`);
      }
    }

    if (safeProject.dataInizio && !isValidDateString(safeProject.dataInizio)) {
      safeProject.dataInizio = null;
      errors.push(`Progetto ${index + 1}: data inizio non valida`);
    }

    if (safeProject.dataFine && !isValidDateString(safeProject.dataFine)) {
      safeProject.dataFine = null;
      errors.push(`Progetto ${index + 1}: data fine non valida`);
    }

    const phases = Array.isArray(safeProject.fasi) ? safeProject.fasi : [];
    if (!Array.isArray(safeProject.fasi)) {
      errors.push(`Progetto ${index + 1}: fasi non valide`);
    }

    safeProject.fasi = phases.map((fase, phaseIndex) =>
      normalizePhase(fase, index, phaseIndex, errors)
    );

    return safeProject;
  }

  function validateAndFixProjects(projects) {
    const errors = [];
    const normalizedProjects = (projects || []).map((project, index) =>
      normalizeProject(project, index, errors)
    );

    return {
      errors,
      projects: normalizedProjects
    };
  }

  function getPhasesSummary(project) {
    if (!Array.isArray(project.fasi)) {
      return {
        total: 0,
        completed: 0,
        delayed: 0
      };
    }

    const total = project.fasi.length;
    const completed = project.fasi.filter(f => f.stato === 'completato').length;
    const delayed = project.fasi.filter(f => isDelayed(f)).length;

    return { total, completed, delayed };
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function createNewProject() {
    return {
      id: generateUUID(),
      nome: '',
      colore: '#3b82f6',
      dataInizio: null,
      dataFine: null,
      stato: 'da_iniziare',
      percentualeCompletamento: null,
      fasi: []
    };
  }

  function getPhaseColor(phaseName, allPhaseNames = []) {
    if (!phaseName) return '#64748b';

    const preset = config.phasePresets.find(p => p.nome === phaseName);
    if (preset) {
      return preset.colore || null;
    }

    const customPhases = allPhaseNames
      .filter(name => !config.phasePresets.some(p => p.nome === name))
      .sort();

    const index = customPhases.indexOf(phaseName);
    if (index >= 0) {
      const colorIndex = index % config.customPhaseColors.length;
      return config.customPhaseColors[colorIndex];
    }

    return '#64748b';
  }

  function getAllPhaseNames(projects) {
    const names = new Set();
    projects.forEach(project => {
      if (Array.isArray(project.fasi)) {
        project.fasi.forEach(fase => {
          if (fase.nome) names.add(fase.nome);
        });
      }
    });
    return Array.from(names);
  }

  function createNewPhase(name = '', options = {}) {
    const resolvedColor = Object.prototype.hasOwnProperty.call(options, 'colore')
      ? options.colore
      : getPhaseColor(name);

    return {
      id: generateUUID(),
      nome: name,
      colore: resolvedColor,
      dataInizio: null,
      dataFine: null,
      stato: 'da_iniziare',
      percentualeCompletamento: null,
      milestone: false,
      includeFestivi: false,
      note: ''
    };
  }

  window.OnlyGantt.logic = {
    calculateProjectPercentage,
    isDelayed,
    isPhaseOutsideProjectRange,
    isMilestoneOutsideProject,
    isPhaseOnHoliday,
    hasPercentage100NotCompleted,
    autoFixPercentage100,
    getProjectAlerts,
    getProjectAlertSeverity,
    validateAndFixProjects,
    getPhasesSummary,
    generateUUID,
    createNewProject,
    createNewPhase,
    getPhaseColor,
    getAllPhaseNames
  };
})();
