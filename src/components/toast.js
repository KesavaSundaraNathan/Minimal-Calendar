// Transient toast messages, optionally with a single inline action.

let timer = null;

function host() {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message, action) {
  const el = host();
  clearTimeout(timer);
  el.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      hide();
      action.onClick();
    });
    el.appendChild(btn);
  }
  el.classList.add('visible');
  timer = setTimeout(hide, action ? 5000 : 2600);
}

export function hide() {
  const el = document.getElementById('toast');
  if (el) el.classList.remove('visible');
}
