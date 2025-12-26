(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const config = window.AppConfig;

  function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    if (month < 0 || month > 11) return null;
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function isItalianHoliday(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    const isFixed = config.holidays.fixed.some(h => h.month === month && h.day === day);
    if (isFixed) return true;

    const easter = window.OnlyGantt.easter.calculateEaster(year);
    const easterMonday = window.OnlyGantt.easter.calculateEasterMonday(year);

    const dateStr = formatDate(date);
    const easterStr = formatDate(easter);
    const easterMondayStr = formatDate(easterMonday);

    return dateStr === easterStr || dateStr === easterMondayStr;
  }

  function getHolidayName(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    const fixed = config.holidays.fixed.find(h => h.month === month && h.day === day);
    if (fixed) return fixed.name;

    const easter = window.OnlyGantt.easter.calculateEaster(year);
    const easterMonday = window.OnlyGantt.easter.calculateEasterMonday(year);

    const dateStr = formatDate(date);
    if (dateStr === formatDate(easter)) return 'Pasqua';
    if (dateStr === formatDate(easterMonday)) return 'Pasquetta';

    return null;
  }

  function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function daysDiff(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date2 - date1) / oneDay);
  }

  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  function compareDates(date1, date2) {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  }

  window.OnlyGantt.dateUtils = {
    parseDate,
    formatDate,
    isWeekend,
    isItalianHoliday,
    getHolidayName,
    getISOWeek,
    getWeekStart,
    getDateRange,
    addDays,
    daysDiff,
    getMonthStart,
    getMonthEnd,
    addMonths,
    compareDates
  };
})();
