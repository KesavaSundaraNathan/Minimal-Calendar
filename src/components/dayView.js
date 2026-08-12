// Day view — events first, then tasks. Everything editable in place.

import { DAYS_FULL, dayOfWeek, longDate } from '../utils/dates.js';
import { eventsOn, isDone, isMultiDay, state, tasksOn } from '../utils/store.js';
import { createItem, deleteInstance, toggleTask, updateItem } from '../utils/actions.js';
import { openEventDialog, openTaskDialog } from './dialogs.js';
import { escapeHtml } from './progress.js';

export function renderDay(root, back) {
  const date = state.selected;
  const events = eventsOn(date);
  const tasks = tasksOn(date);

  root.innerHTML = `
    <div class="day">
      <button class="back" aria-label="Back">← Back</button>
      <h1 class="day-title">${longDate(date)}</h1>
      <p class="day-sub">${DAYS_FULL[dayOfWeek(date)]}</p>

      ${events.length === 0 && tasks.length === 0
        ? '<p class="empty-state">No events or tasks today</p>' : ''}

      <section class="section">
        <div class="section-head">
          <h2>Events</h2>
          <button class="ghost" data-add-event>+ Add event</button>
        </div>
        <ul class="list">
          ${events.map((e) => `
            <li class="row event-row" data-id="${e.id}">
              <span class="dash">–</span>
              <span class="row-title" data-edit-title="event">${escapeHtml(e.title)}</span>
              ${e.isRecurring ? '<span class="tag" title="Recurs yearly">◕ Yearly</span>' : ''}
              ${isMultiDay(e) ? '<span class="tag">→ Multi-day</span>' : ''}
              ${e.reminderTime ? `<span class="tag">${e.reminderTime}</span>` : ''}
              <span class="row-actions">
                <button class="icon" data-edit-event aria-label="Edit event">✎</button>
                <button class="icon" data-del-event aria-label="Delete event">✕</button>
              </span>
            </li>`).join('')}
        </ul>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Tasks</h2>
          <button class="ghost" data-add-task-dialog>+ Advanced</button>
        </div>
        <ul class="list">
          ${tasks.map((t) => {
            const done = isDone(t, date);
            return `
            <li class="row task-row prio-${t.priority} ${done ? 'done' : ''}" data-id="${t.id}">
              <input type="checkbox" class="check" ${done ? 'checked' : ''} aria-label="${escapeHtml(t.title)}">
              <span class="row-title" data-edit-title="task">${escapeHtml(t.title)}</span>
              ${t.recurrencePattern ? '<span class="tag">↻</span>' : ''}
              ${isMultiDay(t) ? '<span class="tag">→ Multi-day</span>' : ''}
              ${t.reminderTime ? `<span class="tag">${t.reminderTime}</span>` : ''}
              <span class="row-actions">
                <button class="icon" data-edit-task aria-label="Edit task">✎</button>
                <button class="icon" data-del-task aria-label="Delete task">✕</button>
              </span>
            </li>`;
          }).join('')}
        </ul>
        <div class="task-input">
          <span class="check placeholder" aria-hidden="true"></span>
          <input type="text" id="quick-task" placeholder="Type to add new tasks" maxlength="140" aria-label="New task">
        </div>
      </section>
    </div>`;

  root.querySelector('.back').addEventListener('click', back);
  root.querySelector('[data-add-event]').addEventListener('click', () => openEventDialog(date));
  root.querySelector('[data-add-task-dialog]').addEventListener('click', () => openTaskDialog(date));

  const quick = root.querySelector('#quick-task');
  quick.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const title = quick.value.trim();
    if (!title) return;
    quick.value = '';
    await createItem('task', date, title);
  });

  root.querySelectorAll('.event-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-edit-event]').addEventListener('click', () => {
      openEventDialog(date, events.find((e) => e.id === id));
    });
    row.querySelector('[data-del-event]').addEventListener('click', () => deleteInstance('event', id, date));
    bindInlineEdit(row, 'event', id);
  });

  root.querySelectorAll('.task-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('.check').addEventListener('change', () => toggleTask(id, date));
    row.querySelector('[data-edit-task]').addEventListener('click', () => {
      openTaskDialog(date, tasks.find((t) => t.id === id));
    });
    row.querySelector('[data-del-task]').addEventListener('click', () => deleteInstance('task', id, date));
    bindInlineEdit(row, 'task', id);
  });
}

/** Double-click a title to rename it without opening the full dialogue. */
function bindInlineEdit(row, kind, id) {
  const title = row.querySelector('.row-title');
  title.addEventListener('dblclick', () => {
    const original = title.textContent;
    title.contentEditable = 'true';
    title.classList.add('editing');
    title.focus();
    document.getSelection().selectAllChildren(title);

    let closed = false;
    const finish = async (save) => {
      if (closed) return;
      closed = true;
      title.contentEditable = 'false';
      title.classList.remove('editing');
      const value = title.textContent.trim();
      if (save && value && value !== original) await updateItem(kind, id, { title: value });
      else title.textContent = original;
    };
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    title.addEventListener('blur', () => finish(true), { once: true });
  });
}
