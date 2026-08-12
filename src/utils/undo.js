// Session-only undo/redo stack (last 20 actions). Cleared when the app closes.

const MAX = 20;
const undoStack = [];
const redoStack = [];

export function record(action) {
  undoStack.push(action);
  if (undoStack.length > MAX) undoStack.shift();
  redoStack.length = 0;
}

export async function undo() {
  const action = undoStack.pop();
  if (!action) return null;
  await action.undo();
  redoStack.push(action);
  if (redoStack.length > MAX) redoStack.shift();
  return action;
}

export async function redo() {
  const action = redoStack.pop();
  if (!action) return null;
  await action.redo();
  undoStack.push(action);
  return action;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}
