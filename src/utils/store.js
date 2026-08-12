// In-memory state with write-through persistence to IndexedDB.

import { db, uid } from './db.js';
import {
  RRULE_DAYS, dayOfWeek, endOfYear, parseYmd, todayYmd, yearOf, timezone
} from './dates.js';

const DEFAULT_SETTINGS = {
  theme: null,                 // null = follow system
  eventReminders: true,
  taskReminders: true,
  badgeVisible: true,
  autoBackup: false,
  autoBackupFrequency: 'monthly',
  lastAutoBackup: null,
  lastSeenYear: null,
  quotes: [],
  defaultView: 'month'
};

export const state = {
  view: 'month',               // month | week | day | log | settings
  previousView: 'month',
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selected: todayYmd(),
  events: [],
  tasks: [],
  settings: { ...DEFAULT_SETTINGS },
  silenced: false,
  history: [],                 // reminders fired today
  timezone: timezone()
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  listeners.forEach((fn) => fn());
}

export async function load() {
  const [events, tasks, settingsRow] = await Promise.all([
    db.getAll('events'),
    db.getAll('tasks'),
    db.get('meta', 'settings')
  ]);
  state.events = events || [];
  state.tasks = tasks || [];
  state.settings = { ...DEFAULT_SETTINGS, ...((settingsRow && settingsRow.value) || {}) };
  const hist = await db.get('meta', 'history');
  if (hist && hist.value && hist.value.date === todayYmd()) state.history = hist.value.items;
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('meta', { key: 'settings', value: state.settings });
  emit();
}

export async function saveHistory() {
  await db.put('meta', { key: 'history', value: { date: todayYmd(), items: state.history } });
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export function parseRRule(rule) {
  const out = { freq: 'NONE', byday: [] };
  if (!rule) return out;
  rule.split(';').forEach((part) => {
    const [k, v] = part.split('=');
    if (k === 'FREQ') out.freq = v;
    if (k === 'BYDAY') out.byday = v.split(',');
  });
  return out;
}

export function buildRRule(freq, byday) {
  if (!freq || freq === 'NONE') return null;
  if (freq === 'WEEKLY' && byday && byday.length) return `FREQ=WEEKLY;BYDAY=${byday.join(',')}`;
  return `FREQ=${freq}`;
}

export function describeRecurrence(item) {
  if (item.isRecurring) return 'Yearly';
  if (!item.recurrencePattern) {
    if (item.endDate && item.endDate !== item.startDate) return 'Multi-day';
    return 'One-time';
  }
  const p = parseRRule(item.recurrencePattern);
  if (p.freq === 'DAILY') return 'Daily';
  if (p.freq === 'MONTHLY') return 'Monthly';
  if (p.freq === 'WEEKLY') return `Weekly (${p.byday.join(', ')})`;
  return 'One-time';
}

function skipped(item, date) {
  return Array.isArray(item.skipDates) && item.skipDates.includes(date);
}

export function taskOccursOn(task, date) {
  if (skipped(task, date)) return false;
  const start = task.startDate || task.date;
  if (task.recurrencePattern) {
    if (date < start) return false;
    const until = task.recurrenceEndDate || endOfYear(yearOf(start));
    if (date > until) return false;
    const p = parseRRule(task.recurrencePattern);
    if (p.freq === 'DAILY') return true;
    if (p.freq === 'WEEKLY') return p.byday.includes(RRULE_DAYS[dayOfWeek(date)]);
    if (p.freq === 'MONTHLY') return parseYmd(date).getDate() === parseYmd(start).getDate();
    return false;
  }
  if (task.endDate && task.endDate !== start) return date >= start && date <= task.endDate;
  return task.date === date;
}

export function eventOccursOn(ev, date) {
  if (skipped(ev, date)) return false;
  if (ev.isRecurring) return ev.date.slice(5) === date.slice(5);
  if (ev.endDate && ev.endDate !== ev.date) return date >= ev.date && date <= ev.endDate;
  return ev.date === date;
}

export function isMultiDay(item) {
  return !!(item.endDate && item.endDate !== (item.startDate || item.date));
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function tasksOn(date) {
  return state.tasks
    .filter((t) => taskOccursOn(t, date))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function eventsOn(date) {
  return state.events
    .filter((e) => eventOccursOn(e, date))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function isDone(task, date) {
  return !!(task.completions && task.completions[date]);
}

/** { total, done, redPct, greenPct } — sharp boundaries, gray when empty. */
export function progressOn(date) {
  const list = tasksOn(date);
  const total = list.length;
  const done = list.filter((t) => isDone(t, date)).length;
  if (total === 0) return { total: 0, done: 0, redPct: 0, greenPct: 0 };
  const greenPct = (done / total) * 100;
  return { total, done, redPct: 100 - greenPct, greenPct };
}

export function hasContent(date) {
  return tasksOn(date).length > 0 || eventsOn(date).length > 0;
}

export function pendingToday() {
  const t = todayYmd();
  return tasksOn(t).filter((x) => !isDone(x, t)).length;
}

/* ------------------------------------------------------------------ */
/* Mutations (raw — undo wrapping happens in actions.js)               */
/* ------------------------------------------------------------------ */

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export async function putRecord(store, record) {
  const list = store === 'tasks' ? state.tasks : state.events;
  const i = list.findIndex((r) => r.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  await db.put(store, record);
  emit();
}

export async function deleteRecord(store, id) {
  const list = store === 'tasks' ? state.tasks : state.events;
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list.splice(i, 1);
  await db.delete(store, id);
  emit();
}

export function newTask(date, title) {
  return {
    id: uid(),
    title,
    date,
    startDate: date,
    endDate: null,
    isCompleted: false,
    completions: {},
    priority: 'normal',
    reminderTime: null,
    recurrencePattern: null,
    recurrenceEndDate: null,
    skipDates: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function newEvent(date, title) {
  return {
    id: uid(),
    title,
    date,
    endDate: null,
    isRecurring: false,
    reminderTime: null,
    skipDates: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function findTask(id) {
  return state.tasks.find((t) => t.id === id);
}

export function findEvent(id) {
  return state.events.find((e) => e.id === id);
}
