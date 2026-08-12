// Monthly view — square date blocks with a progress bar under each date.

import { DAYS_SHORT, monthGrid, parseYmd, todayYmd } from '../utils/dates.js';
import { progressOn, state } from '../utils/store.js';
import { progressBar } from './progress.js';

export function renderMonth(root, go) {
  const cells = monthGrid(state.year, state.month);
  const today = todayYmd();

  root.innerHTML = `
    <div class="month">
      <div class="weekday-row">${DAYS_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="month-grid" role="grid" aria-label="Month grid" style="grid-template-rows: repeat(${cells.weeks}, minmax(0, 1fr));">
        ${cells.map((c) => {
          const p = progressOn(c.date);
          const classes = [
            'date-block',
            c.inMonth ? '' : 'outside',
            c.date === state.selected ? 'selected' : '',
            c.date === today ? 'today' : ''
          ].filter(Boolean).join(' ');
          return `<button class="${classes}" data-date="${c.date}" role="gridcell"
            aria-label="${c.date}, ${p.total} tasks, ${p.done} complete">
            <span class="date-number">${parseYmd(c.date).getDate()}</span>
            ${progressBar(p)}
          </button>`;
        }).join('')}
      </div>
    </div>`;

  root.querySelectorAll('.date-block').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.date));
  });
}
