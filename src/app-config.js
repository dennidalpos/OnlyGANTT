// OnlyGANTT - Centralized Configuration
// This is the ONLY source of truth for all constants

window.AppConfig = {
  // Server configuration
  server: {
    port: 3000,
    dataDir: 'data',
    enableBak: true,
    lockTimeoutMinutes: 60,
    adminSessionTtlHours: 8,
    maxUploadBytes: 2000000
  },

  // Gantt rendering
  gantt: {
    MARGIN_DAYS: 7,
    PIXELS_PER_DAY_4MONTHS: 25,
    CANVAS_TOP_MARGIN: 130,
    CANVAS_LEFT_MARGIN: 260,
    CANVAS_RIGHT_MARGIN: 30,
    CANVAS_BOTTOM_MARGIN: 60,
    ROW_HEIGHT: 40,
    PHASE_BAR_HEIGHT: 24,
    PROJECT_BAR_HEIGHT: 32,
    MILESTONE_COLOR: '#8b5cf6',
    PROJECT_BAR_COLOR: '#94a3b8',
    GRID_COLOR: '#475569',
    GRID_LIGHT_COLOR: '#334155',
    TODAY_LINE_COLOR: '#ef4444',
    WEEKEND_COLOR: 'rgba(71, 85, 105, 0.2)',
    HOLIDAY_COLOR: 'rgba(239, 68, 68, 0.1)',
    TEXT_COLOR: '#f8fafc',
    TEXT_SMALL_COLOR: '#cbd5e1',
    BACKGROUND_COLOR: '#1e293b'
  },

  // Screensaver
  screensaver: {
    idleMs: 15000
  },

  // Lock
  lock: {
    heartbeatMinutes: 5,
    acquireDebounceMs: 300
  },

  // Logic features
  logic: {
    enableAutoFixPercent100ToCompleted: false
  },

  // Italian holidays (fixed dates)
  holidays: {
    fixed: [
      { month: 1, day: 1, name: 'Capodanno' },
      { month: 1, day: 6, name: 'Epifania' },
      { month: 4, day: 25, name: 'Festa della Liberazione' },
      { month: 5, day: 1, name: 'Festa del Lavoro' },
      { month: 6, day: 2, name: 'Festa della Repubblica' },
      { month: 8, day: 15, name: 'Ferragosto' },
      { month: 11, day: 1, name: 'Ognissanti' },
      { month: 12, day: 8, name: 'Immacolata Concezione' },
      { month: 12, day: 25, name: 'Natale' },
      { month: 12, day: 26, name: 'Santo Stefano' }
    ]
  },

  // Valid project/phase states
  states: ['da_iniziare', 'in_corso', 'in_ritardo', 'completato'],

  // State labels (Italian)
  stateLabels: {
    'da_iniziare': 'Da iniziare',
    'in_corso': 'In corso',
    'in_ritardo': 'In ritardo',
    'completato': 'Completato'
  },

  // Phase presets (default phases with colors)
  phasePresets: [
    { nome: 'Analisi', colore: '#3b82f6' },
    { nome: 'Progettazione', colore: '#8b5cf6' },
    { nome: 'Sviluppo', colore: '#10b981' },
    { nome: 'Test', colore: '#f59e0b' },
    { nome: 'Deploy', colore: '#ef4444' },
    { nome: 'Documentazione', colore: '#06b6d4' },
    { nome: 'Review', colore: '#ec4899' },
    { nome: 'Personalizzata', colore: null }
  ],

  // Color pool for custom phases
  customPhaseColors: [
    '#14b8a6', '#84cc16', '#eab308', '#f97316', '#f43f5e',
    '#d946ef', '#a855f7', '#6366f1', '#0ea5e9', '#22c55e',
    '#facc15', '#fb923c', '#f87171', '#c084fc', '#60a5fa'
  ]
};
