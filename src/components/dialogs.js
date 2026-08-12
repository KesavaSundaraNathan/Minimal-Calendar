// Creation / edit dialogues for events and tasks.

import { openModal } from './modal.js';
import { escapeHtml } from './progress.js';
import { createItem, updateItem } from '../utils/actions.js';
import { buildRRule, parseRRule } from '../utils/store.js';
import { RRULE_DAYS, addDays, dayOfWeek, endOfYear, longDate, parseYmd, yearOf, ymd } from '../utils/dates.js';
import { toast } from './toast.js';

const DAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function el(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap;
}

/* ------------------------------- Events ------------------------------- */

export function openEventDialog(date, existing) {
  const ev = existing || null;
  const recurring = ev ? !!ev.isRecurring : false;
  const multi = !!(ev && ev.endDate && ev.endDate !== ev.date);

  const body = el(`
    <label class="field">
      <span class="field-label">Event title</span>
      <input type="text" id="ev-title" value="${escapeHtml(ev ? ev.title : '')}" placeholder="Event title" maxlength="120">
    </label>
    <div class="field">
      <span class="field-label">Recurrence</span>
      <div class="radio-row">
        <label class="radio"><input type="radio" name="ev-rec" value="yearly" ${recurring ? 'checked' : ''}><span>Yearly</span></label>
        <label class="radio"><input type="radio" name="ev-rec" value="once" ${recurring ? '' : 'checked'}><span>One-time</span></label>
        <span class="clock" id="ev-clock" title="Recurrence indicator">${recurring ? '◕' : '◔'}</span>
      </div>
      <span class="field-hint" id="ev-rec-hint">${recurring ? 'Repeats on this date every year.' : 'Kept for one calendar year, then cleared.'}</span>
    </div>
    <div class="field">
      <label class="check-row"><input type="checkbox" id="ev-multi" ${multi ? 'checked' : ''}><span>Spans multiple days</span></label>
      <div class="range-row ${multi ? '' : 'hidden'}" id="ev-range">
        <input type="date" id="ev-start" value="${ev ? ev.date : date}">
        <span class="range-arrow">→</span>
        <input type="date" id="ev-end" value="${ev && ev.endDate ? ev.endDate : addDays(date, 1)}">
      </div>
    </div>
    <label class="field">
      <span class="field-label">Reminder time (optional)</span>
      <input type="time" id="ev-reminder" value="${ev && ev.reminderTime ? ev.reminderTime : ''}">
      <span class="field-hint">Uses your system timezone automatically.</span>
    </label>
  `);

  body.querySelectorAll('[name="ev-rec"]').forEach((r) => r.addEventListener('change', () => {
    const yearly = body.querySelector('[name="ev-rec"]:checked').value === 'yearly';
    body.querySelector('#ev-clock').textContent = yearly ? '◕' : '◔';
    body.querySelector('#ev-rec-hint').textContent = yearly
      ? 'Repeats on this date every year.'
      : 'Kept for one calendar year, then cleared.';
  }));
  body.querySelector('#ev-multi').addEventListener('change', (e) => {
    body.querySelector('#ev-range').classList.toggle('hidden', !e.target.checked);
  });

  openModal({
    title: ev ? 'Edit event' : 'Add event',
    body,
    confirmLabel: ev ? 'Save' : 'Add',
    onConfirm: async () => {
      const title = body.querySelector('#ev-title').value.trim();
      if (!title) return false;
      const isRecurring = body.querySelector('[name="ev-rec"]:checked').value === 'yearly';
      const spans = body.querySelector('#ev-multi').checked;
      const start = spans ? body.querySelector('#ev-start').value : (ev ? ev.date : date);
      let end = spans ? body.querySelector('#ev-end').value : null;
      if (end && end < start) end = start;
      const reminderTime = body.querySelector('#ev-reminder').value || null;
      const patch = { title, isRecurring, reminderTime, date: start, endDate: spans ? end : null };
      if (ev) await updateItem('event', ev.id, patch);
      else await createItem('event', start, title, patch);
      return true;
    }
  });
}

/* -------------------------------- Tasks ------------------------------- */

export function openTaskDialog(date, existing) {
  const t = existing || null;
  const rule = parseRRule(t && t.recurrencePattern);
  const freq = t && t.recurrencePattern ? rule.freq : 'NONE';
  const byday = rule.byday.length ? rule.byday : [RRULE_DAYS[dayOfWeek(date)]];
  const multi = !!(t && t.endDate && t.endDate !== (t.startDate || t.date));
  const baseDate = t ? (t.startDate || t.date) : date;
  const endMode = t && t.recurrenceEndDate ? 'until' : 'none';

  const body = el(`
    <label class="field">
      <span class="field-label">Task title</span>
      <input type="text" id="tk-title" value="${escapeHtml(t ? t.title : '')}" placeholder="Task title" maxlength="140">
    </label>
    <div class="field">
      <span class="field-label">Priority</span>
      <div class="radio-row">
        ${['high', 'medium', 'normal'].map((p) => `
          <label class="radio prio-${p}"><input type="radio" name="tk-prio" value="${p}" ${(t ? t.priority : 'normal') === p ? 'checked' : ''}><span>${p[0].toUpperCase() + p.slice(1)}</span></label>
        `).join('')}
      </div>
    </div>
    <label class="field">
      <span class="field-label">Reminder time (optional)</span>
      <input type="time" id="tk-reminder" value="${t && t.reminderTime ? t.reminderTime : ''}">
    </label>
    <div class="field">
      <span class="field-label">Repeats</span>
      <select id="tk-freq">
        <option value="NONE" ${freq === 'NONE' ? 'selected' : ''}>No recurrence</option>
        <option value="DAILY" ${freq === 'DAILY' ? 'selected' : ''}>Every day</option>
        <option value="WEEKLY" ${freq === 'WEEKLY' ? 'selected' : ''}>Weekly on selected days</option>
        <option value="MONTHLY" ${freq === 'MONTHLY' ? 'selected' : ''}>Monthly on this date</option>
      </select>
      <div class="day-picker ${freq === 'WEEKLY' ? '' : 'hidden'}" id="tk-days">
        ${DAY_LABELS.map((d) => `<button type="button" class="day-chip ${byday.includes(d) ? 'on' : ''}" data-day="${d}">${d}</button>`).join('')}
      </div>
    </div>
    <div class="field ${freq === 'NONE' ? 'hidden' : ''}" id="tk-end-block">
      <span class="field-label">Recurrence ends</span>
      <select id="tk-endmode">
        <option value="none" ${endMode === 'none' ? 'selected' : ''}>End of ${yearOf(baseDate)}</option>
        <option value="months">Repeat for X months</option>
        <option value="until" ${endMode === 'until' ? 'selected' : ''}>Repeat until date</option>
      </select>
      <div class="inline-row hidden" id="tk-months-row">
        <input type="number" id="tk-months" min="1" max="12" value="3"><span class="field-hint">months</span>
      </div>
      <div class="inline-row ${endMode === 'until' ? '' : 'hidden'}" id="tk-until-row">
        <input type="date" id="tk-until" value="${t && t.recurrenceEndDate ? t.recurrenceEndDate : endOfYear(yearOf(baseDate))}">
      </div>
    </div>
    <div class="field">
      <label class="check-row"><input type="checkbox" id="tk-multi" ${multi ? 'checked' : ''}><span>Spans multiple days</span></label>
      <div class="range-row ${multi ? '' : 'hidden'}" id="tk-range">
        <input type="date" id="tk-start" value="${baseDate}">
        <span class="range-arrow">→</span>
        <input type="date" id="tk-end" value="${t && t.endDate ? t.endDate : addDays(baseDate, 1)}">
      </div>
    </div>
  `);

  body.querySelectorAll('.day-chip').forEach((chip) => chip.addEventListener('click', () => {
    chip.classList.toggle('on');
  }));
  body.querySelector('#tk-freq').addEventListener('change', (e) => {
    const v = e.target.value;
    body.querySelector('#tk-days').classList.toggle('hidden', v !== 'WEEKLY');
    body.querySelector('#tk-end-block').classList.toggle('hidden', v === 'NONE');
  });
  body.querySelector('#tk-endmode').addEventListener('change', (e) => {
    body.querySelector('#tk-months-row').classList.toggle('hidden', e.target.value !== 'months');
    body.querySelector('#tk-until-row').classList.toggle('hidden', e.target.value !== 'until');
  });
  body.querySelector('#tk-multi').addEventListener('change', (e) => {
    body.querySelector('#tk-range').classList.toggle('hidden', !e.target.checked);
  });

  openModal({
    title: t ? 'Edit task' : 'Add task',
    body,
    confirmLabel: t ? 'Save' : 'Add',
    onConfirm: async () => {
      const title = body.querySelector('#tk-title').value.trim();
      if (!title) return false;
      const priority = body.querySelector('[name="tk-prio"]:checked').value;
      const reminderTime = body.querySelector('#tk-reminder').value || null;
      const selectedFreq = body.querySelector('#tk-freq').value;
      const days = [...body.querySelectorAll('.day-chip.on')].map((c) => c.dataset.day);
      const pattern = selectedFreq === 'WEEKLY' && !days.length
        ? null
        : buildRRule(selectedFreq, days);

      const spans = body.querySelector('#tk-multi').checked;
      const start = spans ? body.querySelector('#tk-start').value : baseDate;
      let end = spans ? body.querySelector('#tk-end').value : null;
      if (end && end < start) end = start;

      let recurrenceEndDate = null;
      if (pattern) {
        const mode = body.querySelector('#tk-endmode').value;
        if (mode === 'months') {
          const months = Math.min(12, Math.max(1, Number(body.querySelector('#tk-months').value) || 1));
          const d = parseYmd(start);
          d.setMonth(d.getMonth() + months);
          recurrenceEndDate = ymd(d);
        } else if (mode === 'until') {
          recurrenceEndDate = body.querySelector('#tk-until').value || null;
        } else {
          recurrenceEndDate = endOfYear(yearOf(start));
        }
      }

      const patch = {
        title, priority, reminderTime,
        recurrencePattern: pattern,
        recurrenceEndDate,
        date: start,
        startDate: start,
        endDate: spans ? end : null
      };
      if (t) await updateItem('task', t.id, patch);
      else await createItem('task', start, title, patch);
      return true;
    }
  });
}

/** Quick single-field rename used by double-click inline editing fallback. */
export function openRenameDialog(kind, item) {
  const body = el(`<label class="field"><span class="field-label">Title</span>
    <input type="text" id="rn-title" value="${escapeHtml(item.title)}" maxlength="140"></label>`);
  openModal({
    title: 'Rename',
    body,
    confirmLabel: 'Save',
    onConfirm: async () => {
      const title = body.querySelector('#rn-title').value.trim();
      if (!title) return false;
      await updateItem(kind, item.id, { title });
      toast('Renamed');
      return true;
    }
  });
}

export { longDate };
