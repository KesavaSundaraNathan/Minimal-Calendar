// Settings — Notifications, Data management, Customise, Advanced.
// Every section is collapsed by default and expands on click.

import { emit, saveSettings, state } from '../utils/store.js';
import { db } from '../utils/db.js';
import { exportCsv, exportJson, exportPdf, restore, runAutoBackup } from '../utils/backup.js';
import { clearHistory, requestPermission } from '../utils/notifications.js';
import { confirmModal, openModal } from './modal.js';
import { toast } from './toast.js';
import { escapeHtml } from './progress.js';
import { timezone } from '../utils/dates.js';

const APP_VERSION = '1.0.0';

const open = { notifications: false, data: false, customise: false, advanced: false };

function toggleRow(id, label, checked, hint) {
  return `<div class="setting">
    <div class="setting-text"><span>${label}</span>${hint ? `<span class="field-hint">${hint}</span>` : ''}</div>
    <label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} aria-label="${label}"><span class="slider"></span></label>
  </div>`;
}

function section(key, title, inner) {
  return `<section class="settings-section">
    <button class="section-toggle" data-section="${key}" aria-expanded="${open[key]}">${title} <span>${open[key] ? '−' : '+'}</span></button>
    <div class="settings-body ${open[key] ? '' : 'hidden'}">${inner}</div>
  </section>`;
}

export function renderSettings(root, back, openLog) {
  const s = state.settings;
  const quotes = s.quotes || [];

  root.innerHTML = `
    <div class="page">
      <button class="back" aria-label="Back">← Back</button>
      <h1 class="page-title">Settings</h1>

      ${section('notifications', 'Notifications', `
        ${toggleRow('set-ev-rem', 'Event reminders', s.eventReminders)}
        ${toggleRow('set-tk-rem', 'Task reminders', s.taskReminders)}
        ${toggleRow('set-both', 'Enable both', s.eventReminders && s.taskReminders, 'Shortcut toggle')}
        ${toggleRow('set-badge', 'In-app badge (top-right)', s.badgeVisible)}
        <div class="setting">
          <div class="setting-text"><span>Silence all reminders today</span><span class="field-hint">${state.silenced ? 'Currently silenced' : 'Active'}</span></div>
          <button class="ghost" id="set-silence">${state.silenced ? 'Unsilence' : 'Silence'}</button>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Reminder history</span><span class="field-hint">${state.history.length} today</span></div>
          <button class="ghost" id="set-history">View</button>
        </div>
        <div class="setting">
          <div class="setting-text"><span>System notifications</span><span class="field-hint">Timezone ${timezone()}</span></div>
          <button class="ghost" id="set-permission">Allow</button>
        </div>`)}

      ${section('data', 'Data management', `
        <div class="setting">
          <div class="setting-text"><span>Export events</span><span class="field-hint">CSV or PDF</span></div>
          <span class="btn-pair">
            <button class="ghost" id="exp-csv">CSV</button>
            <button class="ghost" id="exp-pdf">PDF</button>
          </span>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Export log</span><span class="field-hint">Full JSON backup</span></div>
          <button class="ghost" id="exp-json">Export</button>
        </div>
        ${toggleRow('set-auto', 'Auto-backup', s.autoBackup, s.lastAutoBackup ? `Last run ${s.lastAutoBackup}` : 'Never run')}
        <div class="setting">
          <div class="setting-text"><span>Frequency</span></div>
          <select id="set-freq" aria-label="Backup frequency">
            ${['weekly', 'monthly', 'six-monthly'].map((f) => `<option value="${f}" ${s.autoBackupFrequency === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Backup now</span></div>
          <span class="btn-pair"><span class="spinner hidden" id="backup-spin"></span>
          <button class="ghost" id="backup-now">Run</button></span>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Restore from backup</span><span class="field-hint">Overwrites current data</span></div>
          <button class="ghost" id="restore-btn">Restore</button>
          <input type="file" id="restore-file" accept="application/json" hidden>
        </div>`)}

      ${section('customise', 'Customise', `
        <div class="setting">
          <div class="setting-text"><span>Default view on startup</span><span class="field-hint">Where the app opens</span></div>
          <select id="set-default-view" aria-label="Default view">
            <option value="month" ${s.defaultView === 'month' ? 'selected' : ''}>Calendar view</option>
            <option value="week" ${s.defaultView === 'week' ? 'selected' : ''}>Weekly view</option>
            <option value="day" ${s.defaultView === 'day' ? 'selected' : ''}>Daily view</option>
          </select>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Your own quotes</span><span class="field-hint">${quotes.length ? `${quotes.length} in rotation — replaces the built-in messages` : 'Built-in messages are in use'}</span></div>
        </div>
        <ul class="quote-list">
          ${quotes.map((q, i) => `<li class="quote-row"><span>${escapeHtml(q)}</span>
            <button class="icon" data-quote-del="${i}" aria-label="Remove quote">✕</button></li>`).join('')}
        </ul>
        <div class="quote-add">
          <input type="text" id="quote-input" placeholder="Add your own line" maxlength="90" aria-label="New quote">
          <button class="ghost" id="quote-add-btn">Add</button>
        </div>`)}

      ${section('advanced', 'Advanced', `
        <div class="setting">
          <div class="setting-text"><span>Log page</span><span class="field-hint">Full-year archive</span></div>
          <button class="ghost" id="open-log">Open</button>
        </div>
        <div class="setting">
          <div class="setting-text"><span>Clear all data</span><span class="field-hint danger">Cannot be undone</span></div>
          <button class="ghost danger" id="clear-all">Clear</button>
        </div>
        <div class="setting">
          <div class="setting-text"><span>App version</span></div>
          <span class="field-hint">${APP_VERSION}</span>
        </div>
        <div class="setting">
          <div class="setting-text"><span>About</span></div>
          <span class="field-hint">Authenwrite Studio · local-only calendar</span>
        </div>`)}
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const rerender = () => renderSettings(root, back, openLog);

  $('.back').addEventListener('click', back);

  root.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      open[btn.dataset.section] = !open[btn.dataset.section];
      rerender();
    });
  });

  /* Notifications */
  if (open.notifications) {
    $('#set-ev-rem').addEventListener('change', (e) => saveSettings({ eventReminders: e.target.checked }));
    $('#set-tk-rem').addEventListener('change', (e) => saveSettings({ taskReminders: e.target.checked }));
    $('#set-both').addEventListener('change', (e) => saveSettings({
      eventReminders: e.target.checked, taskReminders: e.target.checked
    }));
    $('#set-badge').addEventListener('change', (e) => saveSettings({ badgeVisible: e.target.checked }));

    $('#set-silence').addEventListener('click', () => {
      if (state.silenced) {
        state.silenced = false;
        emit();
        return;
      }
      confirmModal('Silence reminders', 'Mute all reminders for today until the app closes?', () => {
        state.silenced = true;
        emit();
        toast('Reminders silenced');
      });
    });
    $('#set-history').addEventListener('click', openHistory);
    $('#set-permission').addEventListener('click', async () => {
      const result = await requestPermission();
      toast(result === 'granted' ? 'Notifications allowed' : `Permission: ${result}`);
    });
  }

  /* Data management */
  if (open.data) {
    $('#exp-csv').addEventListener('click', () => exportCsv());
    $('#exp-pdf').addEventListener('click', () => exportPdf());
    $('#exp-json').addEventListener('click', async () => {
      const ok = await exportJson();
      if (ok) toast('Log exported');
    });
    $('#set-auto').addEventListener('change', (e) => saveSettings({ autoBackup: e.target.checked }));
    $('#set-freq').addEventListener('change', (e) => saveSettings({ autoBackupFrequency: e.target.value }));
    $('#backup-now').addEventListener('click', async () => {
      const spin = $('#backup-spin');
      spin.classList.remove('hidden');
      const ok = await runAutoBackup();
      spin.classList.add('hidden');
      if (ok) toast(`Backup complete at ${new Date().toLocaleTimeString()}`);
    });
    const fileInput = $('#restore-file');
    $('#restore-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      confirmModal('Restore backup', 'This will overwrite all current data.', async () => {
        try {
          await restore(file);
          toast('Backup restored');
        } catch (err) {
          toast('Restore failed — file not recognised');
        }
        fileInput.value = '';
      }, { danger: true, confirmLabel: 'Restore' });
    });
  }

  /* Customise */
  if (open.customise) {
    $('#set-default-view').addEventListener('change', (e) => {
      saveSettings({ defaultView: e.target.value });
      toast(`Opens in ${e.target.selectedOptions[0].textContent.toLowerCase()}`);
    });

    const input = $('#quote-input');
    const addQuote = () => {
      const value = input.value.trim();
      if (!value) return;
      saveSettings({ quotes: [...(state.settings.quotes || []), value] });
      input.value = '';
    };
    $('#quote-add-btn').addEventListener('click', addQuote);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addQuote(); }
    });

    root.querySelectorAll('[data-quote-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.quoteDel);
        const next = (state.settings.quotes || []).filter((_, idx) => idx !== i);
        saveSettings({ quotes: next });
      });
    });
  }

  /* Advanced */
  if (open.advanced) {
    $('#open-log').addEventListener('click', openLog);
    $('#clear-all').addEventListener('click', () => {
      confirmModal('Clear all data', 'Every event and task on this device will be deleted. This cannot be undone.', async () => {
        await db.clear('events');
        await db.clear('tasks');
        state.events = [];
        state.tasks = [];
        emit();
        toast('All data cleared');
      }, { danger: true, confirmLabel: 'Delete everything' });
    });
  }
}

export function openHistory() {
  const body = document.createElement('div');
  body.className = 'history';
  body.innerHTML = state.history.length
    ? `<ul class="list">${state.history.map((h) => `
        <li class="row"><span class="tag">${h.at}</span><span class="row-title">${escapeHtml(h.title)}</span></li>`).join('')}</ul>`
    : '<p class="empty-state">No reminders triggered today</p>';
  openModal({
    title: 'Reminder history',
    body,
    confirmLabel: 'Clear history',
    cancelLabel: 'Close',
    onConfirm: () => {
      clearHistory();
      toast('History cleared');
    }
  });
}
