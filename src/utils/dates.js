// Date helpers — all dates handled as local-time YYYY-MM-DD strings.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date object -> "YYYY-MM-DD" (local time) */
export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date object at local midnight */
export function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayYmd() {
  return ymd(new Date());
}

export function yearOf(str) {
  return Number(str.slice(0, 4));
}

export function addDays(str, n) {
  const d = parseYmd(str);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function dayOfWeek(str) {
  return parseYmd(str).getDay();
}

/** "26 January 2026" */
export function longDate(str) {
  const d = parseYmd(str);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "January - 26" */
export function headerLabel(year, month) {
  return `${MONTHS[month]} - ${pad(year % 100)}`;
}

/**
 * Calendar grid for a month, trimmed to the weeks it actually needs (5 or 6
 * rows) so the whole month fits on one screen without scrolling.
 */
export function monthGrid(year, month) {
  const offset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ date: ymd(d), inMonth: d.getMonth() === month });
  }
  cells.weeks = weeks;
  return cells;
}

/** Sunday-first week containing the given date. */
export function weekOf(str) {
  const start = addDays(str, -dayOfWeek(str));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function endOfYear(year) {
  return `${year}-12-31`;
}

export function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}

export function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'local';
  }
}

/** Current local time as "HH:MM" */
export function nowHm() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
