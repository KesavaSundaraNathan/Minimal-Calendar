// Log page — full archive of events and tasks with search, filters and bulk delete.

import { describeRecurrence, isMultiDay, state } from '../utils/store.js';
import { deletePermanent } from '../utils/actions.js';
import { confirmModal } from './modal.js';
import { openEventDialog, openTaskDialog } from './dialogs.js';
import { escapeHtml } from './progress.js';
import { longDate } from '../utils/dates.js';

const ui = { query: '', filter: 'all', sort: 'date', expanded: null, selection: new Set() };

function collect() {
  const rows = [
    ...state.events.map((e) => ({
      kind: 'event', id: e.id, title: e.title, date: e.date, record: e,
      recurring: !!e.isRecurring, recurrence: describeRecurrence(e)
    })),
    ...state.tasks.map((t) => ({
      kind: 'task', id: t.id, title: t.title, date: t.startDate || t.date, record: t,
      recurring: !!t.recurrencePattern, recurrence: describeRecurrence(t)
    }))
  ];

  const q = ui.query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (ui.filter === 'events' && r.kind !== 'event') return false;
    if (ui.filter === 'tasks' && r.kind !== 'task') return false;
    if (ui.filter === 'recurring' && !r.recurring) return false;
    if (ui.filter === 'onetime' && r.recurring) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q)
      || r.date.includes(q)
      || r.recurrence.toLowerCase().includes(q);
  });

  filtered.sort((a, b) => {
    if (ui.sort === 'created') return b.record.createdAt - a.record.createdAt;
    if (ui.sort === 'recurrence') return a.recurrence.localeCompare(b.recurrence) || a.date.localeCompare(b.date);
    return a.date.localeCompare(b.date);
  });
  return filtered;
}

export function renderLog(root, back) {
  const rows = collect();
  const selected = ui.selection.size;

  root.innerHTML = `
    <div class="page">
      <button class="back" aria-label="Back">← Back</button>
      <h1 class="page-title">Log</h1>
      <div class="log-controls">
        <input type="search" id="log-search" placeholder="Search titles and dates" value="${escapeHtml(ui.query)}" aria-label="Search log">
        <select id="log-filter" aria-label="Filter">
          <option value="all" ${ui.filter === 'all' ? 'selected' : ''}>All</option>
          <option value="events" ${ui.filter === 'events' ? 'selected' : ''}>Events only</option>
          <option value="tasks" ${ui.filter === 'tasks' ? 'selected' : ''}>Tasks only</option>
          <option value="recurring" ${ui.filter === 'recurring' ? 'selected' : ''}>Recurring</option>
          <option value="onetime" ${ui.filter === 'onetime' ? 'selected' : ''}>One-time</option>
        </select>
        <select id="log-sort" aria-label="Sort">
          <option value="date" ${ui.sort === 'date' ? 'selected' : ''}>Sort by date</option>
          <option value="recurrence" ${ui.sort === 'recurrence' ? 'selected' : ''}>Sort by recurrence</option>
          <option value="created" ${ui.sort === 'created' ? 'selected' : ''}>Sort by created</option>
        </select>
      </div>
      <div class="log-bulk ${selected ? '' : 'hidden'}">
        <span>${selected} selected</span>
        <button class="ghost danger" id="bulk-delete">Delete selected</button>
      </div>
      <ul class="log-list">
        ${rows.length === 0 ? '<li class="empty-state">Nothing logged yet</li>' : ''}
        ${rows.map((r) => `
          <li class="log-item ${ui.expanded === r.id ? 'open' : ''}" data-id="${r.id}" data-kind="${r.kind}">
            <div class="log-line">
              <input type="checkbox" class="check" data-select ${ui.selection.has(r.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(r.title)}">
              <button class="log-main" data-expand>
                <span class="log-title">${escapeHtml(r.title)}</span>
                <span class="log-meta">${r.date} · ${r.kind === 'task' ? 'Task' : 'Event'} · ${r.recurrence}</span>
              </button>
            </div>
            ${ui.expanded === r.id ? detail(r) : ''}
          </li>`).join('')}
      </ul>
    </div>`;

  root.querySelector('.back').addEventListener('click', back);

  const search = root.querySelector('#log-search');
  let debounce = null;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      ui.query = search.value;
      renderLog(root, back);
      const box = root.querySelector('#log-search');
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    }, 200);
  });
  root.querySelector('#log-filter').addEventListener('change', (e) => {
    ui.filter = e.target.value;
    renderLog(root, back);
  });
  root.querySelector('#log-sort').addEventListener('change', (e) => {
    ui.sort = e.target.value;
    renderLog(root, back);
  });

  root.querySelectorAll('.log-item').forEach((item) => {
    const id = item.dataset.id;
    const kind = item.dataset.kind;
    item.querySelector('[data-select]').addEventListener('change', (e) => {
      if (e.target.checked) ui.selection.add(id); else ui.selection.delete(id);
      renderLog(root, back);
    });
    item.querySelector('[data-expand]').addEventListener('click', () => {
      ui.expanded = ui.expanded === id ? null : id;
      renderLog(root, back);
    });
    const editBtn = item.querySelector('[data-edit]');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const rec = kind === 'task'
          ? state.tasks.find((t) => t.id === id)
          : state.events.find((e) => e.id === id);
        if (!rec) return;
        const base = rec.startDate || rec.date;
        if (kind === 'task') openTaskDialog(base, rec); else openEventDialog(base, rec);
      });
    }
    const delBtn = item.querySelector('[data-delete]');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        confirmModal('Delete permanently',
          'This removes the item and any future recurrences.',
          async () => {
            await deletePermanent(kind, id);
            ui.selection.delete(id);
            ui.expanded = null;
          }, { danger: true, confirmLabel: 'Delete' });
      });
    }
  });

  const bulk = root.querySelector('#bulk-delete');
  if (bulk) {
    bulk.addEventListener('click', () => {
      const count = ui.selection.size;
      confirmModal('Bulk delete', `Delete selected ${count} item${count === 1 ? '' : 's'}? Recurring patterns are removed entirely.`,
        async () => {
          for (const id of [...ui.selection]) {
            const kind = state.tasks.some((t) => t.id === id) ? 'task' : 'event';
            await deletePermanent(kind, id, true);
          }
          ui.selection.clear();
        }, { danger: true, confirmLabel: 'Delete' });
    });
  }
}

function detail(r) {
  const rec = r.record;
  return `
    <div class="log-detail">
      <dl>
        <div><dt>Date</dt><dd>${longDate(r.date)}</dd></div>
        ${isMultiDay(rec) ? `<div><dt>Ends</dt><dd>${longDate(rec.endDate)}</dd></div>` : ''}
        <div><dt>Recurrence</dt><dd>${r.recurrence}</dd></div>
        ${rec.recurrenceEndDate ? `<div><dt>Repeats until</dt><dd>${longDate(rec.recurrenceEndDate)}</dd></div>` : ''}
        ${r.kind === 'task' ? `<div><dt>Priority</dt><dd>${rec.priority}</dd></div>` : ''}
        ${rec.reminderTime ? `<div><dt>Reminder</dt><dd>${rec.reminderTime}</dd></div>` : ''}
        <div><dt>Created</dt><dd>${new Date(rec.createdAt).toLocaleDateString()}</dd></div>
      </dl>
      <div class="log-actions">
        <button class="ghost" data-edit>Edit</button>
        <button class="ghost danger" data-delete>Delete</button>
      </div>
    </div>`;
}
