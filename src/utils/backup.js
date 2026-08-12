// Export / import / year rollover. Everything stays on the local device.

import { db } from './db.js';
import { clone, describeRecurrence, emit, saveSettings, state } from './store.js';
import { daysBetween, longDate, stamp, todayYmd, yearOf } from './dates.js';

export function snapshot() {
  return {
    app: 'Authenwrite Calendar',
    version: 1,
    exportedAt: new Date().toISOString(),
    timezone: state.timezone,
    events: clone(state.events),
    tasks: clone(state.tasks)
  };
}

export function filename(ext) {
  return `authenwrite-calendar-backup-${stamp()}.${ext}`;
}

async function save(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function exportJson() {
  return save(filename('json'), JSON.stringify(snapshot(), null, 2), 'application/json');
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportCsv() {
  const rows = [['Type', 'Title', 'Date', 'End date', 'Recurrence', 'Priority', 'Reminder', 'Created']];
  state.events.forEach((e) => rows.push([
    'Event', e.title, e.date, e.endDate || '', describeRecurrence(e), '', e.reminderTime || '',
    new Date(e.createdAt).toISOString().slice(0, 10)
  ]));
  state.tasks.forEach((t) => rows.push([
    'Task', t.title, t.startDate || t.date, t.endDate || '', describeRecurrence(t), t.priority,
    t.reminderTime || '', new Date(t.createdAt).toISOString().slice(0, 10)
  ]));
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  return save(filename('csv'), csv, 'text/csv');
}

/** Opens a clean print view — Windows "Save as PDF" produces the file. */
export function exportPdf() {
  const rows = [
    ...state.events.map((e) => ({ type: 'Event', title: e.title, date: e.date, meta: describeRecurrence(e) })),
    ...state.tasks.map((t) => ({ type: 'Task', title: t.title, date: t.startDate || t.date, meta: `${describeRecurrence(t)} · ${t.priority}` }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Authenwrite Calendar Log</title>
    <style>
      body{font-family:-apple-system,'SF Pro Display','Segoe UI',sans-serif;color:#1a1a19;margin:40px;line-height:1.4}
      h1{font-size:24px;margin:0 0 4px}p.sub{margin:0 0 28px;color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e5e5e5}
      th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666}
    </style></head><body>
    <h1>Authenwrite Calendar — Log</h1>
    <p class="sub">Exported ${longDate(todayYmd())}</p>
    <table><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Details</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r.date}</td><td>${r.type}</td><td>${r.title}</td><td>${r.meta}</td></tr>`).join('')}
    </tbody></table></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
  return true;
}

export async function restore(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.tasks)) {
    throw new Error('Unrecognised backup file');
  }
  await db.clear('events');
  await db.clear('tasks');
  for (const e of data.events) await db.put('events', e);
  for (const t of data.tasks) await db.put('tasks', t);
  state.events = data.events;
  state.tasks = data.tasks;
  emit();
}

/* ------------------------------------------------------------------ */
/* Automated backup                                                    */
/* ------------------------------------------------------------------ */

const FREQ_DAYS = { weekly: 7, monthly: 30, 'six-monthly': 182 };

export function autoBackupDue() {
  if (!state.settings.autoBackup) return false;
  const last = state.settings.lastAutoBackup;
  if (!last) return true;
  return daysBetween(last, todayYmd()) >= (FREQ_DAYS[state.settings.autoBackupFrequency] || 30);
}

export async function runAutoBackup() {
  const ok = await exportJson();
  if (ok) await saveSettings({ lastAutoBackup: todayYmd() });
  return ok;
}

/* ------------------------------------------------------------------ */
/* Year transition                                                     */
/* ------------------------------------------------------------------ */

/** Days remaining before the current year's non-recurring data expires. */
export function expiryNotice() {
  const today = todayYmd();
  const year = yearOf(today);
  const start = `${year}-12-15`;
  if (today < start) return null;
  const remaining = daysBetween(today, `${year}-12-31`) + 1;
  return { year, remaining };
}

export function needsYearRollover() {
  const year = yearOf(todayYmd());
  const seen = state.settings.lastSeenYear;
  return seen !== null && seen !== undefined && seen < year;
}

/** Removes expired one-time items; recurring yearly events carry over untouched. */
export async function runYearRollover(deleteLocal) {
  const year = yearOf(todayYmd());
  if (deleteLocal) {
    const staleEvents = state.events.filter((e) => !e.isRecurring && yearOf(e.date) < year);
    const staleTasks = state.tasks.filter((t) => {
      const base = t.startDate || t.date;
      if (yearOf(base) >= year) return false;
      if (!t.recurrencePattern) return true;
      const until = t.recurrenceEndDate;
      return !until || yearOf(until) < year;
    });
    for (const e of staleEvents) {
      await db.delete('events', e.id);
      state.events.splice(state.events.findIndex((x) => x.id === e.id), 1);
    }
    for (const t of staleTasks) {
      await db.delete('tasks', t.id);
      state.tasks.splice(state.tasks.findIndex((x) => x.id === t.id), 1);
    }
  }
  await saveSettings({ lastSeenYear: year });
  emit();
}
