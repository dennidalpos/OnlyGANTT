// Easter calculation using Meeus/Jones/Butcher algorithm (Gregorian calendar)
// Exposed on window.OnlyGantt.easter

(function() {
  'use strict';

  window.OnlyGantt = window.OnlyGantt || {};

  /**
   * Calculate Easter Sunday for a given year (Gregorian calendar)
   * @param {number} year - The year
   * @returns {Date} Easter Sunday date
   */
  function calculateEaster(year) {
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

  /**
   * Calculate Easter Monday (Pasquetta)
   * @param {number} year - The year
   * @returns {Date} Easter Monday date
   */
  function calculateEasterMonday(year) {
    const easter = calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easterMonday.getDate() + 1);
    return easterMonday;
  }

  // Expose on namespace
  window.OnlyGantt.easter = {
    calculateEaster,
    calculateEasterMonday
  };
})();
