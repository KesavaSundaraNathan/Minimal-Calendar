// App shell — header, footer, view routing and scroll-wheel navigation.

import { emit, pendingToday, progressOn, saveSettings, state, subscribe } from './utils/store.js';
import { addDays, headerLabel, parseYmd, todayYmd } from './utils/dates.js';
import { renderMonth } from './components/monthView.js';
import { renderWeek } from './components/weekView.js';
import { renderDay } from './components/dayView.js';
import { renderLog } from './components/logPage.js';
import { openHistory, renderSettings } from './components/settingsPage.js';
import { confirmModal, openModal } from './components/modal.js';
import { toast } from './components/toast.js';
import { completeAllOn } from './utils/actions.js';
import { autoBackupDue, expiryNotice, needsYearRollover, runAutoBackup, runYearRollover } from './utils/backup.js';

const MESSAGES_LOW = [
  'Progress beats regret', 'Small steps, big wins', 'Start with one thing', 'Begin where you are'
];
const MESSAGES_HIGH = [
  "You're on track", 'Keep going!', 'Momentum looks good on you', 'Almost there'
];

const VIEW_ORDER = ['month', 'week', 'day'];

let root;

/* ------------------------------- Theme -------------------------------- */

export function applyTheme() {
  const stored = state.settings.theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☾' : '☀';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  saveSettings({ theme: next });
}

/* ------------------------------ Navigation ---------------------------- */

export function goToDate(date) {
  state.selected = date;
  const d = parseYmd(date);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.previousView = VIEW_ORDER.includes(state.view) ? state.view : 'month';
  state.view = 'day';
  emit();
}

export function setView(view) {
  state.view = view;
  emit();
}

function stepView(direction) {
  const i = VIEW_ORDER.indexOf(state.view);
  if (i === -1) return;
  const next = VIEW_ORDER[Math.min(VIEW_ORDER.length - 1, Math.max(0, i + direction))];
  if (next !== state.view) {
    state.previousView = state.view;
    state.view = next;
    emit();
  }
}

/** Header arrows move by month, week or day depending on the current view. */
function shiftPeriod(delta) {
  if (state.view === 'week' || state.view === 'day') {
    state.selected = addDays(state.selected, state.view === 'week' ? delta * 7 : delta);
    const d = parseYmd(state.selected);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    emit();
    return;
  }
  let m = state.month + delta;
  let y = state.year;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  state.month = m;
  state.year = y;
  emit();
}

/* -------------------------------- Chrome ------------------------------ */

function renderHeader() {
  const label = state.view === 'day' || state.view === 'week'
    ? headerLabel(parseYmd(state.selected).getFullYear(), parseYmd(state.selected).getMonth())
    : headerLabel(state.year, state.month);
  document.getElementById('month-label').textContent = label;

  const showArrows = VIEW_ORDER.includes(state.view);
  document.getElementById('prev-month').classList.toggle('hidden', !showArrows);
  document.getElementById('next-month').classList.toggle('hidden', !showArrows);
  document.getElementById('help-btn').classList.toggle('hidden', state.view !== 'settings');

  const badge = document.getElementById('badge');
  const count = pendingToday();
  badge.classList.toggle('hidden', !state.settings.badgeVisible);
  badge.querySelector('.badge-count').textContent = count;
  badge.querySelector('.badge-count').classList.toggle('hidden', count === 0);
  badge.classList.toggle('silenced', state.silenced);
}

function renderFooter() {
  const custom = state.settings.quotes || [];
  const p = progressOn(todayYmd());
  const pool = custom.length ? custom : (p.total > 0 && p.greenPct >= 50 ? MESSAGES_HIGH : MESSAGES_LOW);
  const day = parseYmd(todayYmd()).getDate();
  document.getElementById('message').textContent = pool[day % pool.length];

  const menu = document.getElementById('view-menu');
  menu.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === state.view);
  });
}

function openBadgeMenu() {
  const body = document.createElement('div');
  body.className = 'menu';
  body.innerHTML = `
    <button class="menu-item" data-clear>Clear all today's tasks</button>
    <button class="menu-item" data-silence>${state.silenced ? 'Unsilence reminders' : 'Silence all reminders'}</button>
    <button class="menu-item" data-history>View reminder history</button>`;

  body.querySelector('[data-clear]').addEventListener('click', () => {
    confirmModal("Clear today's tasks", 'Mark every task for today as complete?', async () => {
      await completeAllOn(todayYmd());
      toast('Today cleared');
    });
  });
  body.querySelector('[data-silence]').addEventListener('click', () => {
    if (state.silenced) {
      state.silenced = false;
      emit();
      toast('Reminders active');
      return;
    }
    confirmModal('Silence reminders', 'Mute all reminders for today until the app closes?', () => {
      state.silenced = true;
      emit();
      toast('Reminders silenced');
    });
  });
  body.querySelector('[data-history]').addEventListener('click', openHistory);

  openModal({
    title: `${pendingToday()} task${pendingToday() === 1 ? '' : 's'} left today`,
    body,
    hideConfirm: true,
    cancelLabel: 'Close'
  });
}

/* -------------------------------- Help -------------------------------- */

export function openHelp() {
  const body = document.createElement('div');
  body.className = 'help-body';
  body.innerHTML = `
    <h3>Switching views</h3>
    <ul>
      <li>Hold <kbd>Shift</kbd> and scroll <strong>up</strong> twice to go deeper: calendar → weekly → daily.</li>
      <li>Hold <kbd>Shift</kbd> and scroll <strong>down</strong> twice to come back out.</li>
      <li>Or use the eye icon in the bottom-right corner to pick a view directly.</li>
      <li>Plain scrolling never changes the view, so long lists scroll normally.</li>
    </ul>
    <h3>Moving through time</h3>
    <ul>
      <li>The arrows beside the month name move by month, week or day, matching the view you are in.</li>
      <li>Clicking any date block opens that day.</li>
    </ul>
    <h3>Tasks and progress</h3>
    <ul>
      <li>Type in the task line on a day page and press <kbd>Enter</kbd> to add a task.</li>
      <li>Each date's bar is red for what is left and green for what is done; grey means no tasks.</li>
      <li>Repeating tasks are ticked off independently on every date.</li>
      <li>Double-click a title to rename it without opening the dialogue.</li>
    </ul>
    <h3>Shortcuts</h3>
    <ul>
      <li><kbd>Ctrl</kbd>+<kbd>N</kbd> new task · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redo · <kbd>Esc</kbd> close</li>
    </ul>`;
  openModal({ title: 'How this app works', body, hideConfirm: true, cancelLabel: 'Close' });
}

/* --------------------------- View switcher ---------------------------- */

function toggleViewMenu(force) {
  const menu = document.getElementById('view-menu');
  const btn = document.getElementById('view-btn');
  const show = force !== undefined ? force : menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !show);
  btn.setAttribute('aria-expanded', String(show));
}

/* ------------------------------- Banner ------------------------------- */

let bannerDismissed = false;

function renderBanner() {
  const banner = document.getElementById('banner');
  const notice = expiryNotice();
  if (!notice || bannerDismissed) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  banner.classList.remove('hidden');
  banner.innerHTML = `<span>Data from ${notice.year} will expire in ${notice.remaining} day${notice.remaining === 1 ? '' : 's'}. Backup now?</span>
    <span class="banner-actions">
      <button class="ghost" data-backup>Backup</button>
      <button class="icon" data-dismiss aria-label="Dismiss">✕</button>
    </span>`;
  banner.querySelector('[data-backup]').addEventListener('click', async () => {
    const ok = await runAutoBackup();
    if (ok) toast('Backup complete');
  });
  banner.querySelector('[data-dismiss]').addEventListener('click', () => {
    bannerDismissed = true;
    banner.classList.add('hidden');
  });
}

export async function checkYearTransition() {
  const year = new Date().getFullYear();
  if (state.settings.lastSeenYear === null || state.settings.lastSeenYear === undefined) {
    await saveSettings({ lastSeenYear: year });
    return;
  }
  if (!needsYearRollover()) return;
  const previous = state.settings.lastSeenYear;
  const body = document.createElement('p');
  body.className = 'modal-text';
  body.textContent = `${previous} data has been archived. A backup is available in Settings → Log page. Delete the local copy?`;
  openModal({
    title: 'New year',
    body,
    confirmLabel: 'Yes, delete',
    cancelLabel: 'No, keep archived',
    danger: true,
    onConfirm: async () => {
      await runYearRollover(true);
      toast(`${previous} data cleared`);
    },
    onCancel: async () => {
      await runYearRollover(false);
    }
  });
}

export async function maybeAutoBackup() {
  if (!autoBackupDue()) return;
  const spinner = document.getElementById('footer-spinner');
  if (spinner) spinner.classList.remove('hidden');
  const ok = await runAutoBackup();
  if (spinner) spinner.classList.add('hidden');
  if (ok) toast(`Backup complete at ${new Date().toLocaleTimeString()}`);
}

/* -------------------------------- Render ------------------------------ */

export function render() {
  root.classList.toggle('fixed-height', state.view === 'month' || state.view === 'week');
  renderHeader();
  renderFooter();
  renderBanner();
  const back = () => {
    state.view = VIEW_ORDER.includes(state.previousView) ? state.previousView : 'month';
    emit();
  };
  if (state.view === 'month') renderMonth(root, goToDate);
  else if (state.view === 'week') renderWeek(root, goToDate);
  else if (state.view === 'day') renderDay(root, back);
  else if (state.view === 'log') renderLog(root, back);
  else if (state.view === 'settings') {
    renderSettings(root, back, () => {
      state.previousView = 'settings';
      state.view = 'log';
      emit();
    });
  }
  applyTheme();
}

/* -------------------------------- Wheel ------------------------------- */

function attachWheel() {
  let steps = 0;
  let last = 0;
  let cooldown = 0;
  window.addEventListener('wheel', (e) => {
    if (!e.shiftKey) return;                       // plain scrolling stays scrolling
    if (!VIEW_ORDER.includes(state.view)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const now = Date.now();
    if (now - cooldown < 400) return;
    if (now - last > 600) steps = 0;
    last = now;
    const delta = e.deltaY || e.deltaX;            // Shift+wheel can report deltaX
    if (!delta) return;
    steps += delta < 0 ? 1 : -1;
    if (steps >= 2) { stepView(1); steps = 0; cooldown = now; }
    if (steps <= -2) { stepView(-1); steps = 0; cooldown = now; }
  }, { passive: true });
}

/* -------------------------------- Mount ------------------------------- */

export function mount() {
  root = document.getElementById('view');

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('badge').addEventListener('click', openBadgeMenu);
  document.getElementById('settings-btn').addEventListener('click', () => {
    if (state.view !== 'settings') state.previousView = VIEW_ORDER.includes(state.view) ? state.view : 'month';
    state.view = state.view === 'settings' ? state.previousView : 'settings';
    emit();
  });
  document.getElementById('prev-month').addEventListener('click', () => shiftPeriod(-1));
  document.getElementById('next-month').addEventListener('click', () => shiftPeriod(1));

  document.getElementById('help-btn').addEventListener('click', openHelp);

  const viewBtn = document.getElementById('view-btn');
  const viewMenu = document.getElementById('view-menu');
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleViewMenu();
  });
  viewMenu.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleViewMenu(false);
      setView(btn.dataset.view);
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.view-switch')) toggleViewMenu(false);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  subscribe(render);
  attachWheel();
  render();
}

export { stepView };
