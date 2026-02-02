const crypto = require('crypto');

const VALID_STATES = ['da_iniziare', 'in_corso', 'in_ritardo', 'completato'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDateString(str) {
  if (!str || typeof str !== 'string') return false;
  if (!DATE_REGEX.test(str)) return false;
  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date instanceof Date &&
    !isNaN(date) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

function validatePhase(phase, index) {
  const errors = [];

  if (!phase || typeof phase !== 'object') {
    errors.push(`Phase ${index}: must be an object`);
    return errors;
  }

  if (phase.id !== undefined && !isValidUUID(phase.id)) {
    errors.push(`Phase ${index}: invalid id format`);
  }

  if (!phase.nome || typeof phase.nome !== 'string' || !phase.nome.trim()) {
    errors.push(`Phase ${index}: nome is required and must be a non-empty string`);
  }

  if (phase.dataInizio != null && !isValidDateString(phase.dataInizio)) {
    errors.push(`Phase ${index}: dataInizio must be null or valid YYYY-MM-DD date`);
  }
  if (phase.dataFine != null && !isValidDateString(phase.dataFine)) {
    errors.push(`Phase ${index}: dataFine must be null or valid YYYY-MM-DD date`);
  }

  if (!VALID_STATES.includes(phase.stato)) {
    errors.push(`Phase ${index}: stato must be one of ${VALID_STATES.join(', ')}`);
  }

  if (phase.percentualeCompletamento != null) {
    if (typeof phase.percentualeCompletamento !== 'number' ||
        phase.percentualeCompletamento < 0 ||
        phase.percentualeCompletamento > 100) {
      errors.push(`Phase ${index}: percentualeCompletamento must be null or a number between 0 and 100`);
    }
  }

  if (typeof phase.milestone !== 'boolean') {
    errors.push(`Phase ${index}: milestone must be a boolean`);
  }

  if (typeof phase.includeFestivi !== 'boolean') {
    errors.push(`Phase ${index}: includeFestivi must be a boolean`);
  }

  if (phase.note !== undefined && typeof phase.note !== 'string') {
    errors.push(`Phase ${index}: note must be a string`);
  }

  return errors;
}

function validateProject(project, index) {
  const errors = [];

  if (!project || typeof project !== 'object') {
    errors.push(`Project ${index}: must be an object`);
    return errors;
  }

  if (project.id !== undefined && !isValidUUID(project.id)) {
    errors.push(`Project ${index}: invalid id format`);
  }

  if (!project.nome || typeof project.nome !== 'string' || !project.nome.trim()) {
    errors.push(`Project ${index}: nome is required and must be a non-empty string`);
  }

  if (!project.colore || typeof project.colore !== 'string') {
    errors.push(`Project ${index}: colore is required and must be a string`);
  }

  if (project.dataInizio != null && !isValidDateString(project.dataInizio)) {
    errors.push(`Project ${index}: dataInizio must be null or valid YYYY-MM-DD date`);
  }
  if (project.dataFine != null && !isValidDateString(project.dataFine)) {
    errors.push(`Project ${index}: dataFine must be null or valid YYYY-MM-DD date`);
  }

  if (!VALID_STATES.includes(project.stato)) {
    errors.push(`Project ${index}: stato must be one of ${VALID_STATES.join(', ')}`);
  }

  if (project.percentualeCompletamento != null) {
    if (typeof project.percentualeCompletamento !== 'number' ||
        project.percentualeCompletamento < 0 ||
        project.percentualeCompletamento > 100) {
      errors.push(`Project ${index}: percentualeCompletamento must be null or a number between 0 and 100`);
    }
  }

  if (!Array.isArray(project.fasi)) {
    errors.push(`Project ${index}: fasi must be an array`);
  } else {
    project.fasi.forEach((phase, phaseIndex) => {
      const phaseErrors = validatePhase(phase, `${index}.${phaseIndex}`);
      errors.push(...phaseErrors);
    });
  }

  return errors;
}

function validateDepartmentData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return ['Data must be an object'];
  }

  if (data.password !== null && data.password !== undefined && typeof data.password !== 'string') {
    errors.push('password must be null or a string');
  }

  if (!Array.isArray(data.projects)) {
    errors.push('projects must be an array');
  } else {
    data.projects.forEach((project, index) => {
      const projectErrors = validateProject(project, index);
      errors.push(...projectErrors);
    });
  }

  if (data.meta && typeof data.meta !== 'object') {
    errors.push('meta must be an object');
  }

  return errors;
}

function generateUUID() {
  return crypto.randomUUID();
}

function ensureIDs(data) {
  if (Array.isArray(data.projects)) {
    data.projects.forEach(project => {
      if (!project.id || !isValidUUID(project.id)) {
        project.id = generateUUID();
      }
      if (Array.isArray(project.fasi)) {
        project.fasi.forEach(phase => {
          if (!phase.id || !isValidUUID(phase.id)) {
            phase.id = generateUUID();
          }
        });
      }
    });
  }
  return data;
}

module.exports = {
  validateDepartmentData,
  validateProject,
  validatePhase,
  ensureIDs,
  isValidUUID
};
