// config.js - Costanti e configurazioni globali

window.CONFIG = {
  DEFAULT_DEPARTMENT: 'Home',
  MS_PER_DAY: 24 * 60 * 60 * 1000,
  IDLE_TIMEOUT: 15000,
  MAX_PHASES_PER_PROJECT: 10,
  CANVAS_MIN_HEIGHT: 220,
  CANVAS_ROW_HEIGHT: 48,
  CANVAS_TOP_MARGIN: 70,
  CANVAS_BOTTOM_MARGIN: 60,
  CANVAS_LEFT_MARGIN: 260,
  CANVAS_RIGHT_MARGIN: 30,
};

window.COLOR_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ab'
];

window.DAY_LETTERS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

window.MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

window.ITALIAN_HOLIDAYS_FIXED = [
  '01-01', '01-06', '04-25', '05-01', '06-02',
  '08-15', '11-01', '12-08', '12-25', '12-26'
];

window.PHASE_OPTIONS = [
  'Analisi',
  'Avvio lavori',
  'Sviluppo',
  'Test',
  'Collaudo',
  'Produzione',
  'Rilascio finale'
];

window.PHASE_COLOR_MAP = {
  'Analisi': '#93c5fd',
  'Avvio lavori': '#fed7aa',
  'Sviluppo': '#bbf7d0',
  'Test': '#e9d5ff',
  'Collaudo': '#fef9c3',
  'Produzione': '#bae6fd',
  'Rilascio finale': '#c7d2fe'
};

window.STATUS_LABELS = {
  da_iniziare: 'Da iniziare',
  in_corso: 'In corso',
  in_ritardo: 'In ritardo',
  completato: 'Completato'
};

window.STATUS_OPTIONS = [
  { value: 'da_iniziare', label: window.STATUS_LABELS.da_iniziare },
  { value: 'in_corso', label: window.STATUS_LABELS.in_corso },
  { value: 'in_ritardo', label: window.STATUS_LABELS.in_ritardo },
  { value: 'completato', label: window.STATUS_LABELS.completato }
];

window.PERCENT_PRESETS = [0, 25, 50, 75, 100];

window.ZOOM_LEVELS = {
  DAYS: 'giorni',
  WEEKS: 'settimane',
  MONTHS: 'mesi'
};

// Contatore globale per generare ID univoci
window.globalIdCounter = 0;

window.createId = function(prefix) {
  window.globalIdCounter += 1;
  return `${prefix}_${window.globalIdCounter}_${Date.now()}`;
};