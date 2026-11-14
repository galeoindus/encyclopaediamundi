/* Static pages: theme, and the one keyboard shortcut that matters.
 *
 * These pages are plain HTML so a crawler can read them; the only behaviour
 * they need is the light/dark switch that every other page has.
 */
import { initTheme } from './core.js';

initTheme();

document.addEventListener('keydown', (event) => {
  if (event.key !== '/') return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  const field = document.querySelector('.em-ask input');
  if (!field) return;
  event.preventDefault();
  field.focus();
});
