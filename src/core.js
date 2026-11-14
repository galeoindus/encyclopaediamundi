/* Small shared pieces: escaping, storage, theme, and the language list.
 *
 * Everything here is deliberately dependency-free — the site ships no bundler,
 * so a module is whatever the browser can import.
 */

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'اردو' },
  { code: 'sa', label: 'संस्कृतम्' },
];

export const KEY = {
  theme: 'em:theme',
  lang: 'em:lang',
  depth: 'em:depth',
  saved: 'em:saved',
  history: 'em:history',
  chat: 'em:chat',
  runtime: 'em:runtime',
  ollama: 'em:ollama',
};

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const clip = (value, max = 400) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, a full quota, or storage switched off — none of it is fatal */
  }
}

export function drop(key) {
  try { localStorage.removeItem(key); } catch { /* nothing to do */ }
}

/* ── theme ──────────────────────────────────────────────────────────────── */

export function paintTheme(theme) {
  const next = theme === 'light' || theme === 'dark'
    ? theme
    : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = next;
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', next === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
  }
  return next;
}

export function initTheme() {
  paintTheme(read(KEY.theme, ''));
  // The header is rebuilt on every route, so a listener bound to the button is
  // destroyed with the button — which is why the theme switch did nothing after
  // the first navigation. One listener on the document outlives every header.
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-theme-toggle]');
    if (!button) return;
    event.preventDefault();
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    write(KEY.theme, next);
    paintTheme(next);
  });
}

/* ── a tiny DOM helper ──────────────────────────────────────────────────── */

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ── urls ───────────────────────────────────────────────────────────────── */

export function wikiUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://en.wikipedia.org/');
    if (!/(^|\.)wikipedia\.org$|(^|\.)wikimedia\.org$|(^|\.)wikidata\.org$/.test(url.hostname)) return '';
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return '';
  }
}

export function hostOf(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/* ── the brand mark, drawn once ─────────────────────────────────────────── */

export const MARK = `<svg viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="emMarkG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f7d63"/><stop offset="1" stop-color="#08302a"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="26" fill="url(#emMarkG)"/>
  <path d="M28 31 L48 66 L68 31" fill="none" stroke="#f7f3ea" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="48" cy="24.5" r="5.2" fill="#e0a06a"/>
</svg>`;
