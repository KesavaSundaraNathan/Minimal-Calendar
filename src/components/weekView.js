// Weekly view — seven rounded blocks, each block is its own progress bar.

import { DAYS_SHORT, dayOfWeek, parseYmd, todayYmd, weekOf } from '../utils/dates.js';
import { hasContent, progressOn, state } from '../utils/store.js';
import { blockFill } from './progress.js';

export function renderWeek(root, go) {
  const days = weekOf(state.selected);
  const today = todayYmd();

  root.innerHTML = `
    <div class="week">
      ${days.map((d) => {
        const p = progressOn(d);
        const empty = !hasContent(d);
        const classes = [
          'week-block',
          empty ? 'empty' : '',
          d === state.selected ? 'selected' : '',
          d === today ? 'today' : '',
          p.greenPct > 70 || p.redPct > 70 ? 'strong-fill' : ''
        ].filter(Boolean).join(' ');
        return `<button class="${classes}" data-date="${d}"
          aria-label="${d}, ${p.total} tasks, ${p.done} complete">
          ${blockFill(p)}
          <span class="week-label">
            <span class="week-number">${parseYmd(d).getDate()}</span>
            <span class="week-day">${DAYS_SHORT[dayOfWeek(d)]}</span>
          </span>
        </button>`;
      }).join('')}
    </div>`;

  root.querySelectorAll('.week-block').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.date));
  });
}
