// SVG progress bars — sharp colour boundaries, no gradients.

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Thin bar used under each date in the monthly view. */
export function progressBar(progress) {
  const label = progress.total === 0
    ? 'No tasks'
    : `${progress.done} of ${progress.total} tasks complete`;
  if (progress.total === 0) {
    return `<svg class="bar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="${label}">
      <rect x="0" y="0" width="100" height="6" fill="var(--gray)"></rect></svg>`;
  }
  return `<svg class="bar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="${label}">
    <rect x="0" y="0" width="${progress.redPct}" height="6" fill="var(--red)"></rect>
    <rect x="${progress.redPct}" y="0" width="${progress.greenPct}" height="6" fill="var(--green)"></rect>
  </svg>`;
}

/** Full-block fill used as the background of weekly view blocks. */
export function blockFill(progress) {
  if (progress.total === 0) {
    return `<svg class="block-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" fill="var(--gray)" opacity="0.35"></rect></svg>`;
  }
  return `<svg class="block-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="0" y="0" width="${progress.redPct}" height="100" fill="var(--red)" opacity="0.85"></rect>
    <rect x="${progress.redPct}" y="0" width="${progress.greenPct}" height="100" fill="var(--green)" opacity="0.85"></rect>
  </svg>`;
}
