import { getPref } from './store.js';
import { prefersReducedMotion } from './ui.js';

/** Theme selection is owned by global-theme.js on every route. This module
 * keeps only home-app reading comfort and progress behaviour. */
export function initTheme() {
  window.IndusTheme?.sync();
  // Reading comfort is chosen in the preferences panel; this only applies the
  // stored choice at boot so the page never flashes the wrong surface.
  applyComfort(getPref('comfort', false));
  initProgress();
}

function applyComfort(on) {
  document.documentElement.setAttribute('data-comfort', on ? 'opaque' : 'auto');
}

function initProgress() {
  const bar = document.getElementById('readBar');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / max) * 100)) : 0;
    bar.style.width = `${pct}%`;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

export { prefersReducedMotion };
