const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBrowserScript(context, relativePath) {
  const filePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, context, { filename: filePath });
}

function listClientSourceFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return listClientSourceFiles(fullPath);
    }
    if (/\.(js|jsx)$/.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

function assertNoNativeDialogs(repoRoot) {
  const clientRoot = path.join(repoRoot, 'src', 'client');
  const files = listClientSourceFiles(clientRoot);
  const nativeDialogPattern = /(^|[^.\w$])(alert|confirm|prompt)\s*\(/gm;
  const violations = [];

  files.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    let match;
    while ((match = nativeDialogPattern.exec(source)) !== null) {
      const matchedText = match[2];
      const lineNumber = source.slice(0, match.index).split('\n').length;
      violations.push(`${path.relative(repoRoot, filePath)}:${lineNumber}:${matchedText}`);
    }
  });

  assert.deepStrictEqual(violations, [], `Native dialogs are not allowed in client code:\n${violations.join('\n')}`);
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function createClientContext() {
  const sandbox = {
    console,
    Math,
    Date,
    setTimeout,
    clearTimeout,
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.navigator = {};

  const context = vm.createContext(sandbox);
  loadBrowserScript(context, 'src/app-config.js');
  loadBrowserScript(context, 'src/utils/easter.js');
  loadBrowserScript(context, 'src/utils/utils-date.js');
  loadBrowserScript(context, 'src/utils/utils-logic.js');
  loadBrowserScript(context, 'src/utils/utils-gantt.js');
  loadBrowserScript(context, 'src/client/storage.js');
  return context;
}

function createSampleProject() {
  return {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nome: 'Roadmap',
    colore: '#2563eb',
    dataInizio: '2026-04-01',
    dataFine: '2026-04-30',
    stato: 'in_corso',
    percentualeCompletamento: null,
    fasi: [
      {
        id: '123e4567-e89b-42d3-a456-426614174001',
        nome: 'Analisi',
        colore: '#3b82f6',
        dataInizio: '2026-04-01',
        dataFine: '2026-04-10',
        stato: 'completato',
        percentualeCompletamento: 100,
        milestone: false,
        includeFestivi: false,
        note: ''
      },
      {
        id: '123e4567-e89b-42d3-a456-426614174002',
        nome: 'Deploy',
        colore: '#ef4444',
        dataInizio: '2026-04-11',
        dataFine: '2026-04-15',
        stato: 'in_corso',
        percentualeCompletamento: 40,
        milestone: true,
        includeFestivi: false,
        note: ''
      }
    ]
  };
}

function createRecordingCanvasContext() {
  const records = {
    strokes: [],
    strokeRects: [],
    fillTexts: []
  };
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
    currentDash: [],
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    fill() {},
    fillRect() {},
    stroke() {
      records.strokes.push({
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        dash: this.currentDash.slice()
      });
    },
    strokeRect(x, y, width, height) {
      records.strokeRects.push({
        x,
        y,
        width,
        height,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        dash: this.currentDash.slice()
      });
    },
    fillText(text, x, y) {
      records.fillTexts.push({ text, x, y, fillStyle: this.fillStyle, font: this.font });
    },
    strokeText() {},
    measureText(text) {
      return { width: String(text).length * 6 };
    },
    setLineDash(dash) {
      this.currentDash = Array.isArray(dash) ? dash.slice() : [];
    }
  };
  ctx.records = records;
  return ctx;
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  assertNoNativeDialogs(repoRoot);

  const context = createClientContext();
  const easter = context.window.OnlyGantt.easter;
  const dateUtils = context.window.OnlyGantt.dateUtils;
  const logic = context.window.OnlyGantt.logic;
  const gantt = context.window.OnlyGantt.gantt;
  const storage = context.window.OnlyGantt.storage;

  assert.strictEqual(dateUtils.formatDate(easter.calculateEaster(2026)), '2026-04-05');
  assert.strictEqual(dateUtils.formatDate(easter.calculateEasterMonday(2026)), '2026-04-06');
  assert.strictEqual(dateUtils.formatDate(dateUtils.parseDate('2024-02-29')), '2024-02-29');
  assert.strictEqual(dateUtils.parseDate('2026-02-29'), null);
  assert.strictEqual(dateUtils.isItalianHoliday(dateUtils.parseDate('2026-04-06')), true);
  assert.strictEqual(dateUtils.getHolidayName(dateUtils.parseDate('2026-04-06')), 'Pasquetta');

  const invalidProjects = [{
    id: 'bad-id',
    nome: '',
    colore: null,
    dataInizio: '2026-13-40',
    dataFine: 'invalid',
    stato: 'broken',
    percentualeCompletamento: 120,
    fasi: [{
      id: 'bad-phase-id',
      nome: '',
      colore: 123,
      dataInizio: '2026-02-30',
      dataFine: '2026-99-01',
      stato: 'broken',
      percentualeCompletamento: -1,
      milestone: 'nope',
      includeFestivi: 'nope',
      note: 42
    }]
  }];

  const normalized = logic.validateAndFixProjects(invalidProjects);
  assert.ok(normalized.errors.length >= 10);
  assert.match(normalized.projects[0].id, /^[0-9a-f-]{36}$/i);
  assert.strictEqual(normalized.projects[0].nome, 'Progetto 1');
  assert.strictEqual(normalized.projects[0].colore, '#3b82f6');
  assert.strictEqual(normalized.projects[0].stato, 'da_iniziare');
  assert.strictEqual(normalized.projects[0].dataInizio, null);
  assert.strictEqual(normalized.projects[0].dataFine, null);
  assert.strictEqual(normalized.projects[0].fasi[0].nome, 'Fase 1');
  assert.strictEqual(normalized.projects[0].fasi[0].dataInizio, null);
  assert.strictEqual(normalized.projects[0].fasi[0].milestone, false);
  assert.strictEqual(normalized.projects[0].fasi[0].includeFestivi, false);
  assert.strictEqual(normalized.projects[0].fasi[0].note, '');

  const delayedProject = {
    ...createSampleProject(),
    dataInizio: '2000-01-01',
    dataFine: '2000-01-31',
    fasi: [{
      ...createSampleProject().fasi[0],
      dataInizio: '2000-01-01',
      dataFine: '2000-01-10',
      stato: 'in_corso',
      percentualeCompletamento: 100
    }]
  };
  const alerts = logic.getProjectAlerts(delayedProject);
  assert.strictEqual(alerts.projectDelayed, true);
  assert.strictEqual(alerts.percentage100NotCompleted, true);
  assert.strictEqual(logic.getProjectAlertSeverity(alerts), 'error');

  const holidayPhase = {
    dataInizio: '2026-04-05',
    dataFine: '2026-04-06',
    includeFestivi: false
  };
  assert.strictEqual(logic.isPhaseOnHoliday(holidayPhase), true);

  const percentageProject = {
    fasi: [
      { percentualeCompletamento: 100 },
      { percentualeCompletamento: 40 },
      { percentualeCompletamento: 50 }
    ]
  };
  assert.strictEqual(logic.calculateProjectPercentage(percentageProject), 63);

  const allPhaseNames = logic.getAllPhaseNames([createSampleProject(), {
    ...createSampleProject(),
    id: '123e4567-e89b-42d3-a456-426614174099',
    fasi: [{ ...createSampleProject().fasi[0], nome: 'Custom Phase' }]
  }]);
  assert.deepStrictEqual(Array.from(allPhaseNames).sort(), ['Analisi', 'Custom Phase', 'Deploy']);
  assert.strictEqual(logic.getPhaseColor('Analisi'), '#3b82f6');
  assert.strictEqual(logic.getPhaseColor('Custom Phase', allPhaseNames), context.window.AppConfig.customPhaseColors[0]);

  storage.setActiveSession({
    userName: 'mario',
    department: 'Demo',
    userToken: 'user-token',
    adminToken: null
  });
  const activeSession = storage.getActiveSession();
  assert.strictEqual(activeSession.userName, 'mario');
  assert.strictEqual(activeSession.department, 'Demo');
  assert.strictEqual(activeSession.userToken, 'user-token');
  assert.strictEqual(activeSession.adminToken, null);
  storage.clearActiveSession();
  assert.strictEqual(Object.keys(storage.getActiveSession()).length, 0);

  gantt.invalidateCache();
  const filters = {
    showDaySeparators: true,
    showWeekSeparators: true,
    showMonthSeparators: true,
    showYearSeparators: true,
    showDayLetters: true,
    showDayNumbers: true,
    showWeekNumbers: true,
    showMonthYearLabels: true,
    showYearLabels: true,
    showWeekends: false,
    showHolidays: true,
    showOnlyMilestones: false,
    highlightDelays: true,
    showPhaseLabels: true,
    showPhasePercentages: true
  };
  const project = createSampleProject();
  const layout = gantt.getLayout('4months', [project], 1200, filters);
  const cachedLayout = gantt.getLayout('4months', [project], 1200, filters);
  assert.strictEqual(layout, cachedLayout);
  assert.strictEqual(layout.rows.length, 1);
  assert.ok(layout.canvasWidth > 0);
  assert.ok(layout.canvasHeight > context.window.AppConfig.gantt.CANVAS_TOP_MARGIN);
  assert.ok(layout.dateToX[project.dataInizio] >= context.window.AppConfig.gantt.CANVAS_LEFT_MARGIN);
  assert.ok(layout.weeks.length > 0);
  assert.ok(layout.months.length > 0);
  assert.ok(context.window.AppConfig.gantt.CANVAS_TOP_MARGIN >= 150);
  assert.ok(context.window.AppConfig.gantt.CANVAS_BOTTOM_MARGIN >= 150);

  const phaseHit = gantt.hitTest(layout.dateToX['2026-04-02'] + 1, layout.rows[0].y + 10, layout);
  assert.strictEqual(phaseHit.type, 'phase');
  assert.strictEqual(phaseHit.phase.nome, 'Analisi');

  const milestoneHit = gantt.hitTest(layout.dateToX['2026-04-15'], layout.rows[0].y + layout.rows[0].height / 2, layout);
  assert.strictEqual(milestoneHit.type, 'phase');
  assert.strictEqual(milestoneHit.phase.nome, 'Deploy');

  const ctx = createRecordingCanvasContext();
  gantt.render(ctx, layout, {});
  const milestoneLineStrokes = ctx.records.strokes.filter(stroke => stroke.dash.length > 0);
  assert.ok(milestoneLineStrokes.some(stroke => stroke.lineWidth === 2.5 && stroke.strokeStyle === context.window.AppConfig.gantt.MILESTONE_COLOR));
  assert.ok(!milestoneLineStrokes.some(stroke => stroke.lineWidth === 4.5 || stroke.lineWidth === 1.5));

  const dateHit = gantt.hitTest(context.window.AppConfig.gantt.CANVAS_LEFT_MARGIN + 1, layout.rows[0].y - 10, layout);
  assert.strictEqual(dateHit.type, 'date');

  console.log('Client logic regression check passed');
}

main();
