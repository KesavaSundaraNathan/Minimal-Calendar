// All data mutations flow through here so they can be undone and announced.

import {
  clone, deleteRecord, findEvent, findTask, isDone, isMultiDay, newEvent, newTask, putRecord, tasksOn
} from './store.js';
import { record } from './undo.js';
import { toast } from '../components/toast.js';

function storeOf(kind) {
  return kind === 'task' ? 'tasks' : 'events';
}

function findOf(kind, id) {
  return kind === 'task' ? findTask(id) : findEvent(id);
}

export async function createItem(kind, date, title, patch = {}) {
  const item = kind === 'task' ? newTask(date, title) : newEvent(date, title);
  Object.assign(item, patch);
  await putRecord(storeOf(kind), item);
  record({
    label: `${kind} added`,
    undo: () => deleteRecord(storeOf(kind), item.id),
    redo: () => putRecord(storeOf(kind), clone(item))
  });
  return item;
}

export async function updateItem(kind, id, patch) {
  const existing = findOf(kind, id);
  if (!existing) return null;
  const before = clone(existing);
  const after = { ...clone(existing), ...patch, updatedAt: Date.now() };
  await putRecord(storeOf(kind), after);
  record({
    label: `${kind} edited`,
    undo: () => putRecord(storeOf(kind), clone(before)),
    redo: () => putRecord(storeOf(kind), clone(after))
  });
  return after;
}

/** Removes one day's instance of a repeating/multi-day item, or the whole record. */
export async function deleteInstance(kind, id, date) {
  const existing = findOf(kind, id);
  if (!existing) return;
  const repeats = kind === 'task'
    ? (!!existing.recurrencePattern || isMultiDay(existing))
    : (!!existing.isRecurring || isMultiDay(existing));
  const before = clone(existing);

  if (repeats) {
    const after = clone(existing);
    after.skipDates = [...(after.skipDates || []), date];
    after.updatedAt = Date.now();
    await putRecord(storeOf(kind), after);
    record({
      label: `${kind} instance deleted`,
      undo: () => putRecord(storeOf(kind), clone(before)),
      redo: () => putRecord(storeOf(kind), clone(after))
    });
  } else {
    await deleteRecord(storeOf(kind), id);
    record({
      label: `${kind} deleted`,
      undo: () => putRecord(storeOf(kind), clone(before)),
      redo: () => deleteRecord(storeOf(kind), id)
    });
  }
  toast(`${kind === 'task' ? 'Task' : 'Event'} deleted`, {
    label: 'Undo',
    onClick: async () => {
      const { undo } = await import('./undo.js');
      await undo();
      toast('Restored');
    }
  });
}

/** Removes the record entirely, including any recurrence pattern. */
export async function deletePermanent(kind, id, silent) {
  const existing = findOf(kind, id);
  if (!existing) return;
  const before = clone(existing);
  await deleteRecord(storeOf(kind), id);
  record({
    label: `${kind} removed`,
    undo: () => putRecord(storeOf(kind), clone(before)),
    redo: () => deleteRecord(storeOf(kind), id)
  });
  if (!silent) {
    toast(`${kind === 'task' ? 'Task' : 'Event'} removed`, {
      label: 'Undo',
      onClick: async () => {
        const { undo } = await import('./undo.js');
        await undo();
        toast('Restored');
      }
    });
  }
}

export async function toggleTask(id, date) {
  const task = findTask(id);
  if (!task) return;
  const before = clone(task);
  const after = clone(task);
  after.completions = { ...(after.completions || {}) };
  if (after.completions[date]) delete after.completions[date];
  else after.completions[date] = true;
  after.isCompleted = !!after.completions[date];
  after.updatedAt = Date.now();
  await putRecord('tasks', after);
  record({
    label: 'task toggled',
    undo: () => putRecord('tasks', clone(before)),
    redo: () => putRecord('tasks', clone(after))
  });
}

export async function completeAllOn(date) {
  const targets = tasksOn(date).filter((t) => !isDone(t, date));
  const snapshots = targets.map((t) => clone(t));
  for (const t of targets) {
    const after = clone(t);
    after.completions = { ...(after.completions || {}), [date]: true };
    after.isCompleted = true;
    after.updatedAt = Date.now();
    await putRecord('tasks', after);
  }
  record({
    label: 'cleared day',
    undo: async () => {
      for (const s of snapshots) await putRecord('tasks', clone(s));
    },
    redo: () => completeAllOn(date)
  });
}
