// Date utilities
// Exposed on window.OnlyGantt.dateUtils

(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  const config = window.AppConfig;

  /**
   * Parse YYYY-MM-DD string to Date object
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {Date|null} Date object or null if invalid
   */
  function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
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

  /**
   * Format Date object to YYYY-MM-DD string
   * @param {Date} date - Date object
   * @returns {string} Date string in YYYY-MM-DD format
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get today's date as YYYY-MM-DD
   * @returns {string} Today's date
   */
  function getToday() {
    return formatDate(new Date());
  }

  /**
   * Check if a date is a weekend (Saturday or Sunday)
   * @param {Date} date - Date object
   * @returns {boolean} True if weekend
   */
  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if a date is an Italian holiday
   * @param {Date} date - Date object
   * @returns {boolean} True if holiday
   */
  function isItalianHoliday(date) {
    const month = date.getMonth() + 1; // 1-indexed
    const day = date.getDate();
    const year = date.getFullYear();

    // Check fixed holidays
    const isFixed = config.holidays.fixed.some(h => h.month === month && h.day === day);
    if (isFixed) return true;

    // Check Easter and Easter Monday
    const easter = window.OnlyGantt.easter.calculateEaster(year);
    const easterMonday = window.OnlyGantt.easter.calculateEasterMonday(year);

    const dateStr = formatDate(date);
    const easterStr = formatDate(easter);
    const easterMondayStr = formatDate(easterMonday);

    return dateStr === easterStr || dateStr === easterMondayStr;
  }

  /**
   * Get the name of an Italian holiday
   * @param {Date} date - Date object
   * @returns {string|null} Holiday name or null
   */
  function getHolidayName(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    // Check fixed holidays
    const fixed = config.holidays.fixed.find(h => h.month === month && h.day === day);
    if (fixed) return fixed.name;

    // Check Easter
    const easter = window.OnlyGantt.easter.calculateEaster(year);
    const easterMonday = window.OnlyGantt.easter.calculateEasterMonday(year);

    const dateStr = formatDate(date);
    if (dateStr === formatDate(easter)) return 'Pasqua';
    if (dateStr === formatDate(easterMonday)) return 'Pasquetta';

    return null;
  }

  /**
   * Get ISO week number (ISO 8601: Monday is first day)
   * @param {Date} date - Date object
   * @returns {number} Week number
   */
  function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  /**
   * Get the Monday of the ISO week containing the given date
   * @param {Date} date - Date object
   * @returns {Date} Monday of the week
   */
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Generate array of dates in a range (inclusive)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Date[]} Array of dates
   */
  function getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Add days to a date
   * @param {Date} date - Date object
   * @param {number} days - Number of days to add
   * @returns {Date} New date
   */
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get difference in days between two dates
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @returns {number} Difference in days
   */
  function daysDiff(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date2 - date1) / oneDay);
  }

  /**
   * Get start of month
   * @param {Date} date - Date object
   * @returns {Date} First day of month
   */
  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get end of month
   * @param {Date} date - Date object
   * @returns {Date} Last day of month
   */
  function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * Add months to a date
   * @param {Date} date - Date object
   * @param {number} months - Number of months to add
   * @returns {Date} New date
   */
  function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Compare two dates (ignoring time)
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  function compareDates(date1, date2) {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  }

  // Expose on namespace
  window.OnlyGantt.dateUtils = {
    parseDate,
    formatDate,
    getToday,
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
