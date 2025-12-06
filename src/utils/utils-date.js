const dateParseCache = new Map();
const MAX_DATE_CACHE_SIZE = 500;

let todayCache = null;
let todayCacheTimestamp = 0;
const TODAY_CACHE_DURATION = 60000;

window.formatToday = function() {
  const now = Date.now();
  
  if (todayCache && (now - todayCacheTimestamp) < TODAY_CACHE_DURATION) {
    return todayCache;
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  todayCache = `${year}-${month}-${day}`;
  todayCacheTimestamp = now;
  
  return todayCache;
};

window.parseDateStr = function(str) {
  if (!str || typeof str !== 'string') return null;

  if (dateParseCache.has(str)) {
    const cached = dateParseCache.get(str);
    return cached ? new Date(cached) : null;
  }

  const parts = str.split('-');
  if (parts.length !== 3) {
    dateParseCache.set(str, null);
    return null;
  }

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
    dateParseCache.set(str, null);
    return null;
  }

  const date = new Date(y, m - 1, d);
  
  if (isNaN(date.getTime()) || 
      date.getFullYear() !== y || 
      date.getMonth() !== m - 1 || 
      date.getDate() !== d) {
    dateParseCache.set(str, null);
    return null;
  }

  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (dateParseCache.size >= MAX_DATE_CACHE_SIZE) {
    const firstKey = dateParseCache.keys().next().value;
    dateParseCache.delete(firstKey);
  }
  
  dateParseCache.set(str, normalized.getTime());
  return new Date(normalized);
};

const displayFormatCache = new Map();

window.formatDateDisplay = function(str) {
  if (!str) return '';

  if (displayFormatCache.has(str)) {
    return displayFormatCache.get(str);
  }

  const d = window.parseDateStr(str);
  if (!d) {
    displayFormatCache.set(str, str);
    return str;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const result = `${day}/${month}/${year}`;

  if (displayFormatCache.size >= MAX_DATE_CACHE_SIZE) {
    const firstKey = displayFormatCache.keys().next().value;
    displayFormatCache.delete(firstKey);
  }

  displayFormatCache.set(str, result);
  return result;
};

window.formatDateTime = function(dateStr) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

window.diffInDays = function(from, to) {
  if (!from || !to || !(from instanceof Date) || !(to instanceof Date)) {
    return 0;
  }
  
  return Math.round((to.getTime() - from.getTime()) / window.CONFIG.MS_PER_DAY);
};

window.addDays = function(date, days) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return new Date();
  }

  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

window.isSameDate = function(d1, d2) {
  if (!d1 || !d2 || !(d1 instanceof Date) || !(d2 instanceof Date)) {
    return false;
  }

  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

if (typeof window !== 'undefined') {
  setInterval(() => {
    if (dateParseCache.size > MAX_DATE_CACHE_SIZE * 0.8) {
      const entriesToDelete = Math.floor(dateParseCache.size * 0.3);
      const keys = Array.from(dateParseCache.keys()).slice(0, entriesToDelete);
      keys.forEach(key => dateParseCache.delete(key));
    }

    if (displayFormatCache.size > MAX_DATE_CACHE_SIZE * 0.8) {
      const entriesToDelete = Math.floor(displayFormatCache.size * 0.3);
      const keys = Array.from(displayFormatCache.keys()).slice(0, entriesToDelete);
      keys.forEach(key => displayFormatCache.delete(key));
    }
  }, 300000);
}
