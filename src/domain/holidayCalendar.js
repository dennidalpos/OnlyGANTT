import AppConfig from '../app-config.js';

export function calculateEaster(year) {
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
}

export function calculateEasterMonday(year) {
  const easter = calculateEaster(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  return easterMonday;
}

export function isItalianHoliday(date, formatDateFn) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  const isFixed = AppConfig.holidays.fixed.some(h => h.month === month && h.day === day);
  if (isFixed) return true;

  const easter = calculateEaster(year);
  const easterMonday = calculateEasterMonday(year);

  const dateStr = formatDateFn(date);
  const easterStr = formatDateFn(easter);
  const easterMondayStr = formatDateFn(easterMonday);

  return dateStr === easterStr || dateStr === easterMondayStr;
}

export function getHolidayName(date, formatDateFn) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  const fixed = AppConfig.holidays.fixed.find(h => h.month === month && h.day === day);
  if (fixed) return fixed.name;

  const easter = calculateEaster(year);
  const easterMonday = calculateEasterMonday(year);

  const dateStr = formatDateFn(date);
  if (dateStr === formatDateFn(easter)) return 'Pasqua';
  if (dateStr === formatDateFn(easterMonday)) return 'Pasquetta';

  return null;
}

const holidayCalendar = {
  calculateEaster,
  calculateEasterMonday,
  isItalianHoliday,
  getHolidayName
};

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.easter = { calculateEaster, calculateEasterMonday };
  window.OnlyGantt.holidayCalendar = holidayCalendar;
}

export default holidayCalendar;
