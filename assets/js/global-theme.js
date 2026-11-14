/* Veridell — one theme controller for every route.
 * The value is stored in the same JSON format as store.js and is shared by
 * the home SPA, chat, research desk, static articles and utility pages.
 */
(() => {
  'use strict';
  const KEY = 'veridell:theme';
  const MODES = ['auto', 'light', 'dark'];
  const ICONS = {
    auto: '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/>',
    light: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.9v2.4M12 18.7v2.4M4.7 4.7l1.7 1.7M17.6 17.6l1.7 1.7M2.9 12h2.4M18.7 12h2.4M4.7 19.3l1.7-1.7M17.6 6.4l1.7-1.7"/>',
    dark: '<path d="M20.3 14.1A8.5 8.5 0 0 1 9.9 3.7 8.5 8.5 0 1 0 20.3 14.1Z"/>',
  };
  const LABELS = { auto: 'System appearance', light: 'Light appearance', dark: 'Dark appearance' };
  const PREFS = {
    surface: { key: 'veridell:surface-style', values: ['balanced', 'glass', 'soft', 'clay'], fallback: 'balanced' },
    accent: { key: 'veridell:accent-palette', values: ['forest', 'ocean', 'violet', 'amber'], fallback: 'forest' },
    width: { key: 'veridell:reading-width', values: ['comfortable', 'compact', 'wide'], fallback: 'comfortable' },
    scale: { key: 'veridell:reading-scale', values: ['standard', 'large', 'larger'], fallback: 'standard' },
  };
  const preferenceLabels = {
    title: 'Display and reading preferences',
    appearance: 'Appearance', surface: 'Surface style', accent: 'Accent palette', width: 'Reading width', scale: 'Text size',
    options: {
      balanced: 'Balanced', glass: 'Liquid glass', soft: 'Soft / neumorphic', clay: 'Claymorphic',
      forest: 'Forest', ocean: 'Ocean', violet: 'Violet', amber: 'Amber',
      comfortable: 'Comfortable', compact: 'Compact', wide: 'Wide',
      standard: 'Standard', large: 'Large', larger: 'Extra large',
    },
  };
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener() {}, addListener() {} };

  function readMode() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw == null) return 'auto';
      let value = raw;
      try { value = JSON.parse(raw); } catch { /* legacy plain string */ }
      return MODES.includes(value) ? value : 'auto';
    } catch { return 'auto'; }
  }
  function writeMode(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode */ }
  }
  function readPreference(name) {
    const item = PREFS[name];
    if (!item) return '';
    try { const value = localStorage.getItem(item.key); return item.values.includes(value) ? value : item.fallback; }
    catch { return item.fallback; }
  }
  function writePreference(name, value) {
    const item = PREFS[name];
    if (!item || !item.values.includes(value)) return;
    try { localStorage.setItem(item.key, value); } catch { /* private mode */ }
  }
  function paintPreferences() {
    const root = document.documentElement;
    root.dataset.surfaceStyle = readPreference('surface');
    root.dataset.accent = readPreference('accent');
    root.dataset.readingWidth = readPreference('width');
    root.dataset.readingScale = readPreference('scale');
    const selects = { surface: '#im-surface-style', accent: '#im-accent-palette', width: '#im-reading-width', scale: '#im-reading-scale' };
    for (const [name, selector] of Object.entries(selects)) {
      const control = document.querySelector?.(selector);
      if (control) control.value = readPreference(name);
    }
  }
  function resolved(mode = readMode()) {
    return mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode;
  }
  function syncButtons(mode, theme) {
    document.querySelectorAll('#themeBtn,[data-action="theme"],[data-theme-toggle]').forEach((button) => {
      const label = `${LABELS[mode]}. Activate to change theme.`;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.dataset.themeMode = mode;
      const svg = button.matches('#themeBtn')
        ? null
        : button.querySelector('svg[data-theme-icon],svg');
      if (svg) {
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.8');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = ICONS[mode];
      } else if (button.matches('#themeBtn')) {
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[mode]}</svg>`;
      }
    });
  }
  function paint() {
    const mode = readMode();
    const theme = resolved(mode);
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themeMode = mode;
    root.style.colorScheme = theme;
    const research = document.getElementById('research-app');
    if (research) research.dataset.theme = theme;
    // The chat route paints on its own palette, so the browser chrome colour has
    // to follow it there; every other route keeps the site colours.
    const chatPage = document.body?.classList.contains('amigo-chat');
    const colour = chatPage
      ? (theme === 'dark' ? '#0c1120' : '#f5f6ff')
      : (theme === 'dark' ? '#0b1110' : '#f3f6f2');
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', colour));
    syncButtons(mode, theme);
    paintPreferences();
    window.dispatchEvent(new CustomEvent('veridell:themechange', { detail: { mode, theme } }));
    return { mode, theme };
  }
  function cycle() {
    const current = readMode();
    const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
    writeMode(next);
    return paint();
  }
  // A control that exists but sits inside a container the current breakpoint
  // hides (the header's text nav collapses on a phone) is not a control the
  // reader can use, so it does not count as one.
  function visibleControl() {
    return [...document.querySelectorAll('#themeBtn,[data-action="theme"],[data-theme-toggle]')]
      .find((el) => el.getClientRects().length > 0);
  }
  function addMissingControl() {
    if (visibleControl()) return;
    const button = document.createElement('button');
    button.type = 'button';
    if (!document.getElementById('themeBtn')) button.id = 'themeBtn';
    button.setAttribute('data-theme-toggle', '');
    button.className = 'im-theme-toggle';
    button.setAttribute('aria-label', 'Change theme');
    button.title = 'Change theme';
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[readMode()]}</svg>`;
    // Pick the innermost suitable host: a selector list would return the first
    // match in document order, which is the outer header, not its inner row.
    const host = document.querySelector('.topbar-actions')
      || document.querySelector('.topbar-inner')
      || document.querySelector('.top-right')
      || document.querySelector('.topbar')
      || document.querySelector('.top')
      || document.body;
    host.append(button);
  }
  function optionSelect(id, label, values) {
    const wrap = document.createElement('label');
    wrap.className = 'im-pref-row';
    const caption = document.createElement('span');
    caption.textContent = label;
    const select = document.createElement('select');
    select.id = id;
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = preferenceLabels.options[value] || value;
      select.append(option);
    }
    wrap.append(caption, select);
    return { wrap, select };
  }
  function addPreferencesControl() {
    if (document.getElementById('im-preferences')) return;
    const host = visibleControl()?.parentElement
      || document.querySelector('.topbar-actions')
      || document.querySelector('.topbar-inner')
      || document.querySelector('.top-right')
      || document.querySelector('.topbar')
      || document.querySelector('.top')
      || document.body;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'im-preferences';
    button.className = 'im-theme-toggle im-preferences-toggle';
    button.setAttribute('aria-label', preferenceLabels.title);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'im-preferences-panel');
    button.title = preferenceLabels.title;
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.11 2.28 L13.89 2.28 L13.54 4.86 L15.95 5.86 L17.54 3.79 L20.21 6.46 L18.14 8.05 L19.14 10.46 L21.72 10.11 L21.72 13.89 L19.14 13.54 L18.14 15.95 L20.21 17.54 L17.54 20.21 L15.95 18.14 L13.54 19.14 L13.89 21.72 L10.11 21.72 L10.46 19.14 L8.05 18.14 L6.46 20.21 L3.79 17.54 L5.86 15.95 L4.86 13.54 L2.28 13.89 L2.28 10.11 L4.86 10.46 L5.86 8.05 L3.79 6.46 L6.46 3.79 L8.05 5.86 L10.46 4.86 Z"/><circle cx="12" cy="12" r="3.1"/></svg>';
    host.append(button);

    const panel = document.createElement('section');
    panel.id = 'im-preferences-panel';
    panel.className = 'im-preferences-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'im-preferences-title');
    const heading = document.createElement('h2');
    heading.id = 'im-preferences-title';
    heading.textContent = preferenceLabels.title;
    panel.append(heading);

    const appearance = optionSelect('im-appearance-mode', preferenceLabels.appearance, ['auto', 'light', 'dark']);
    const surface = optionSelect('im-surface-style', preferenceLabels.surface, PREFS.surface.values);
    const accent = optionSelect('im-accent-palette', preferenceLabels.accent, PREFS.accent.values);
    const width = optionSelect('im-reading-width', preferenceLabels.width, PREFS.width.values);
    const scale = optionSelect('im-reading-scale', preferenceLabels.scale, PREFS.scale.values);
    panel.append(appearance.wrap, surface.wrap, accent.wrap, width.wrap, scale.wrap);
    const note = document.createElement('p');
    note.className = 'im-pref-note';
    note.textContent = 'Your choices are saved on this device and follow you across Veridell pages.';
    panel.append(note);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'im-pref-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => closePreferences(true));
    panel.append(close);
    document.body.append(panel);

    appearance.select.value = readMode();
    surface.select.value = readPreference('surface');
    accent.select.value = readPreference('accent');
    width.select.value = readPreference('width');
    scale.select.value = readPreference('scale');
    appearance.select.addEventListener('change', () => { writeMode(appearance.select.value); paint(); });
    surface.select.addEventListener('change', () => { writePreference('surface', surface.select.value); paintPreferences(); });
    accent.select.addEventListener('change', () => { writePreference('accent', accent.select.value); paintPreferences(); });
    width.select.addEventListener('change', () => { writePreference('width', width.select.value); paintPreferences(); });
    scale.select.addEventListener('change', () => { writePreference('scale', scale.select.value); paintPreferences(); });
    button.addEventListener('click', () => togglePreferences());
    document.addEventListener('click', (event) => {
      if (panel.hidden || panel.contains(event.target) || button.contains(event.target)) return;
      closePreferences(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); closePreferences(true); }
    });
    paintPreferences();
  }
  function togglePreferences() {
    const panel = document.getElementById('im-preferences-panel');
    const button = document.getElementById('im-preferences');
    if (!panel || !button) return;
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.querySelector('select')?.focus();
  }
  function closePreferences(returnFocus) {
    const panel = document.getElementById('im-preferences-panel');
    const button = document.getElementById('im-preferences');
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
    if (returnFocus) button?.focus();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#themeBtn,[data-action="theme"],[data-theme-toggle]');
    if (!button) return;
    event.preventDefault();
    cycle();
  });
  window.addEventListener('storage', (event) => { if (event.key === KEY) paint(); else if (Object.values(PREFS).some((item) => item.key === event.key)) paintPreferences(); });
  const mediaChange = () => { if (readMode() === 'auto') paint(); };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', mediaChange);
  else if (typeof media.addListener === 'function') media.addListener(mediaChange);
  document.addEventListener('DOMContentLoaded', () => { addMissingControl(); addPreferencesControl(); paint(); });
  // A resize can hide the control the reader was using (or reveal one that was
  // hidden), so re-check on a size change rather than only at load.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { addMissingControl(); paint(); }, 150);
  });
  window.IndusTheme = { paint, sync: paint, set(mode) { if (!MODES.includes(mode)) return paint(); writeMode(mode); return paint(); }, setPreference(name, value) { writePreference(name, value); paintPreferences(); }, cycle, get mode() { return readMode(); } };
  // Resolve the theme before the first contentful paint, including on static pages.
  paint();
})();
