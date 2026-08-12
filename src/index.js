// Entry point.

import { emit, load, state } from './utils/store.js';
import { applyTheme, checkYearTransition, maybeAutoBackup, mount, render } from './App.js';
import { startScheduler } from './utils/notifications.js';
import { redo, undo } from './utils/undo.js';
import { toast } from './components/toast.js';
import { closeModal, isModalOpen } from './components/modal.js';
import { openTaskDialog } from './components/dialogs.js';

function attachKeyboard() {
  document.addEventListener('keydown', async (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (isModalOpen()) { closeModal(); return; }
      if (state.view === 'day' || state.view === 'log' || state.view === 'settings') {
        state.view = 'month';
        emit();
      }
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      if (typing) return;
      e.preventDefault();
      const action = await undo();
      toast(action ? `Undone: ${action.label}` : 'Nothing to undo');
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
      if (typing) return;
      e.preventDefault();
      const action = await redo();
      toast(action ? `Redone: ${action.label}` : 'Nothing to redo');
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openTaskDialog(state.selected);
    }
  });
}

async function start() {
  await load();
  const startView = state.settings.defaultView;
  if (startView === 'week' || startView === 'day' || startView === 'month') state.view = startView;
  applyTheme();
  mount();
  attachKeyboard();
  startScheduler();
  await checkYearTransition();
  await maybeAutoBackup();
  render();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline cache optional */ });
  });
}

start();
