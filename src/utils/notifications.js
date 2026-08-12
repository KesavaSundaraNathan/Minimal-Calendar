// Reminders run on local system time (Intl-detected timezone, no manual selection).

import { eventsOn, isDone, saveHistory, state, tasksOn, emit } from './store.js';
import { longDate, nowHm, todayYmd } from './dates.js';

const firedKey = 'awc-fired';
let fired = new Set();
let tickHandle = null;

function loadFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(firedKey) || '{}');
    if (raw.date === todayYmd()) fired = new Set(raw.keys || []);
    else fired = new Set();
  } catch (e) {
    fired = new Set();
  }
}

function persistFired() {
  localStorage.setItem(firedKey, JSON.stringify({ date: todayYmd(), keys: [...fired] }));
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch (e) {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

async function show(title, body, date) {
  state.history.unshift({ title, body, at: nowHm(), date });
  state.history = state.history.slice(0, 100);
  await saveHistory();
  emit();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    tag: `${title}-${date}`,
    data: { date },
    badge: 'icons/icon-192x192.png',
    icon: 'icons/icon-192x192.png',
    actions: [
      { action: 'snooze-5', title: 'Snooze 5m' },
      { action: 'snooze-15', title: 'Snooze 15m' },
      { action: 'snooze-30', title: 'Snooze 30m' }
    ]
  };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, { body, data: { date } });
  } catch (e) {
    try { new Notification(title, { body }); } catch (err) { /* ignore */ }
  }
}

function tick() {
  if (state.silenced) return;
  const today = todayYmd();
  const hm = nowHm();

  if (state.settings.taskReminders) {
    tasksOn(today).forEach((t) => {
      if (!t.reminderTime || t.reminderTime !== hm || isDone(t, today)) return;
      const key = `t:${t.id}:${today}:${hm}`;
      if (fired.has(key)) return;
      fired.add(key);
      persistFired();
      show(t.title, `Task — ${longDate(today)} at ${hm}`, today);
    });
  }

  if (state.settings.eventReminders) {
    eventsOn(today).forEach((e) => {
      if (!e.reminderTime || e.reminderTime !== hm) return;
      const key = `e:${e.id}:${today}:${hm}`;
      if (fired.has(key)) return;
      fired.add(key);
      persistFired();
      show(e.title, `Event — ${longDate(today)} at ${hm}`, today);
    });
  }
}

export function snooze(title, minutes) {
  setTimeout(() => show(title, `Snoozed reminder — ${longDate(todayYmd())}`, todayYmd()), minutes * 60000);
}

export function startScheduler() {
  loadFired();
  tick();
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 20000);   // fires within ±2s of the target minute
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      const msg = ev.data || {};
      if (msg.type === 'snooze') snooze(msg.title, msg.minutes);
      if (msg.type === 'open-date' && msg.date) {
        state.selected = msg.date;
        state.view = 'day';
        emit();
      }
    });
  }
}

export function clearHistory() {
  state.history = [];
  saveHistory();
  emit();
}
