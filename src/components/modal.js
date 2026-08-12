// Fade-in modal dialogue. Escape closes. Only one modal at a time.

let current = null;

export function isModalOpen() {
  return !!current;
}

export function closeModal() {
  if (!current) return;
  current.root.classList.remove('visible');
  const root = current.root;
  const onDone = current.onClose;
  current = null;
  setTimeout(() => root.remove(), 180);
  if (onDone) onDone();
}

/**
 * openModal({ title, body(HTMLElement), confirmLabel, onConfirm, danger, hideConfirm })
 * onConfirm returns false to keep the modal open.
 */
export function openModal(opts) {
  closeModal();
  const root = document.createElement('div');
  root.className = 'modal-backdrop';
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${opts.title || 'Dialogue'}">
      <h2 class="modal-title">${opts.title || ''}</h2>
      <div class="modal-body"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-cancel>${opts.cancelLabel || 'Cancel'}</button>
        ${opts.hideConfirm ? '' : `<button class="btn btn-primary${opts.danger ? ' btn-danger' : ''}" data-confirm>${opts.confirmLabel || 'Confirm'}</button>`}
      </div>
    </div>`;
  const body = root.querySelector('.modal-body');
  if (opts.body) body.appendChild(opts.body);

  root.addEventListener('mousedown', (e) => {
    if (e.target === root) closeModal();
  });
  root.querySelector('[data-cancel]').addEventListener('click', () => {
    closeModal();
    if (opts.onCancel) opts.onCancel();
  });
  const confirmBtn = root.querySelector('[data-confirm]');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const result = opts.onConfirm ? await opts.onConfirm() : true;
      if (result !== false) closeModal();
    });
  }

  document.body.appendChild(root);
  current = { root, onClose: opts.onClose };
  requestAnimationFrame(() => root.classList.add('visible'));

  const focusTarget = root.querySelector('input, select, textarea, button[data-confirm]');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 60);
  return root;
}

export function confirmModal(title, message, onYes, opts = {}) {
  const body = document.createElement('p');
  body.className = 'modal-text' + (opts.danger ? ' danger' : '');
  body.textContent = message;
  openModal({
    title,
    body,
    confirmLabel: opts.confirmLabel || 'Confirm',
    danger: opts.danger,
    onConfirm: onYes
  });
}

export function field(label, inputHtml, hint) {
  return `<label class="field"><span class="field-label">${label}</span>${inputHtml}${hint ? `<span class="field-hint">${hint}</span>` : ''}</label>`;
}
