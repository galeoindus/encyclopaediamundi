/* Veridell — the icon set.
 *
 * Every icon is a plain SVG string so it can be dropped into innerHTML or an
 * `html` template. One geometry throughout: a 24 x 24 grid, 1.75 stroke,
 * round caps and joins, and shapes drawn to sit optically centred — so a row
 * of them reads as one family instead of a handful of borrowed glyphs.
 *
 * The settings gear is generated as a true eight-tooth outline rather than
 * the old twelve-point path that had a translate/scale baked into it: at
 * 18 px that path rendered as a smudge and sat a pixel off centre.
 */

const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

const F = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  home: S('<path d="M3.9 10.4 12 3.9l8.1 6.5"/><path d="M6 9.3v9.6a1.3 1.3 0 0 0 1.3 1.3h9.4a1.3 1.3 0 0 0 1.3-1.3V9.3"/><path d="M10.1 20.2v-4.9h3.8v4.9"/>'),
  ask: S('<path d="M4.2 11.6a7.8 7.8 0 0 1 15.6 0c0 4.3-3.5 7.8-7.8 7.8-1 0-2-.2-2.9-.6l-3.9 1.5 1.2-3.4a7.8 7.8 0 0 1-2.2-5.3Z"/>'),
  explore: S('<circle cx="12" cy="12" r="8.6"/><path d="m15.3 8.7-1.9 4.7-4.7 1.9 1.9-4.7z"/>'),
  today: S('<rect x="3.7" y="5.3" width="16.6" height="15" rx="3.2"/><path d="M3.7 10.4h16.6M8.2 3.3v3.4M15.8 3.3v3.4"/>'),
  saved: S('<path d="M6.7 4.3h10.6v15.4L12 15.5l-5.3 4.2z"/>'),
  bookmark: S('<path d="M6.7 4.3h10.6v15.4L12 15.5l-5.3 4.2z"/>'),
  topics: S('<path d="m12 3.7 8.4 4.4-8.4 4.4-8.4-4.4z"/><path d="m3.6 12.1 8.4 4.4 8.4-4.4"/><path d="m3.6 16.2 8.4 4.4 8.4-4.4"/>'),
  sources: S('<ellipse cx="12" cy="6.3" rx="7.3" ry="2.9"/><path d="M4.7 6.3v11.4c0 1.6 3.3 2.9 7.3 2.9s7.3-1.3 7.3-2.9V6.3"/><path d="M4.7 12c0 1.6 3.3 2.9 7.3 2.9s7.3-1.3 7.3-2.9"/>'),
  history: S('<path d="M3.7 12a8.3 8.3 0 1 0 2.5-5.9"/><path d="M3.3 4.4v4.3h4.3"/><path d="M12 7.9V12l3.1 1.8"/>'),
  random: S('<path d="M3.8 6.6h2.9c1.2 0 2.3.6 3 1.6l4.6 6.2c.7 1 1.8 1.6 3 1.6h2.9"/><path d="M17.5 4.2 20.3 7l-2.8 2.8"/><path d="M17.5 14.2 20.3 17l-2.8 2.8"/><path d="M3.8 17.4h2.9c1.2 0 2.3-.6 3-1.6l.8-1.1"/><path d="m14.2 9.3.7-1.1c.7-1 1.8-1.6 3-1.6h2.4"/>'),
  mic: S('<rect x="9.3" y="3.4" width="5.4" height="10.2" rx="2.7"/><path d="M5.7 11.3a6.3 6.3 0 0 0 12.6 0M12 17.6v3"/>'),
  comfort: S('<rect x="3.4" y="4.4" width="17.2" height="15.2" rx="3.2"/><path d="M3.4 9.3h17.2M3.4 14.7h17.2"/>'),
  theme: S('<path d="M20.3 14.1A8.5 8.5 0 0 1 9.9 3.7 8.5 8.5 0 1 0 20.3 14.1Z"/>'),
  plus: S('<path d="M12 4.6v14.8M4.6 12h14.8"/>'),
  clock: S('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 1.9"/>'),
  search: S('<circle cx="10.9" cy="10.9" r="6.9"/><path d="m19.6 19.6-4.2-4.2"/>'),
  chevron: S('<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>'),
  arrow: S('<path d="M4.5 12h15M13.4 5.9 19.5 12l-6.1 6.1"/>'),
  external: S('<path d="M14.3 4.5h5.2v5.2M19.5 4.5l-7.7 7.7"/><path d="M18.3 13.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.6a1.7 1.7 0 0 1-1.7-1.7V7.1a1.7 1.7 0 0 1 1.7-1.7h4.4"/>'),
  check: S('<path d="m4.9 12.4 4.6 4.6 9.6-9.6"/>'),
  close: S('<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>'),
  copy: S('<rect x="9.1" y="9.1" width="10.9" height="10.9" rx="2.5"/><path d="M15 6.6V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2h1.1"/>'),
  download: S('<path d="M12 4.2v11m0 0-4-4m4 4 4-4M5 19.4h14"/>'),
  trash: S('<path d="M4.5 7.3h15M9.4 7.3V5.5h5.2v1.8M6.6 7.3 7.6 20h8.8l1-12.7"/>'),
  share: S('<circle cx="6.3" cy="12" r="2.4"/><circle cx="17.7" cy="6.3" r="2.4"/><circle cx="17.7" cy="17.7" r="2.4"/><path d="m8.5 10.8 7-3.5M8.5 13.2l7 3.5"/>'),
  info: S('<circle cx="12" cy="12" r="8.4"/><path d="M12 11.2v5M12 8.3h.01"/>'),
  warn: S('<path d="M12 4.3 3.2 19.3h17.6z"/><path d="M12 10.2v3.9M12 16.7h.01"/>'),
  sparkle: S('<path d="M12 3.3l1.7 4.6 4.6 1.7-4.6 1.7-1.7 4.6-1.7-4.6L5.7 9.6l4.6-1.7z"/><path d="M17.9 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>'),
  flask: S('<path d="M9.2 3.4h5.6M10.3 3.4v6.3l-4.6 8a2 2 0 0 0 1.7 3h9.2a2 2 0 0 0 1.7-3l-4.6-8V3.4"/>'),
  book: S('<path d="M4.6 5.4a1.6 1.6 0 0 1 1.6-1.6h4.2v16.4H6.2a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M10.4 3.8h3.4a1.6 1.6 0 0 1 1.6 1.6v12.8a1.6 1.6 0 0 1-1.6 1.6h-3.4"/><path d="m15.4 6.4 2.9.8a1.6 1.6 0 0 1 1.1 2l-3.1 10.8"/>'),
  library: S('<path d="M4.6 5.4a1.6 1.6 0 0 1 1.6-1.6h4.2v16.4H6.2a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M10.4 3.8h3.4a1.6 1.6 0 0 1 1.6 1.6v12.8a1.6 1.6 0 0 1-1.6 1.6h-3.4"/><path d="m15.4 6.4 2.9.8a1.6 1.6 0 0 1 1.1 2l-3.1 10.8"/>'),
  globe: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z"/>'),
  leaf: S('<path d="M5.2 20.4c-.6-7.6 3.6-13.6 13.6-15 .6 9.6-4.2 14.4-9.8 14.4-1.4 0-2.6-.3-3.8-1z"/><path d="M7.4 18.2c2.6-3.4 5.6-5.8 9-7.4"/>'),
  planet: S('<circle cx="12" cy="12" r="6.8"/><path d="M4.2 15.6c2.4 1.6 8.6-3.8 15.6-1.2"/>'),
  culture: S('<path d="M3.6 5.4h16.8v2.9a8.4 8.4 0 0 1-16.8 0z"/><path d="M7.2 8.3v2.4M16.8 8.3v2.4"/>'),
  math: S('<path d="M6.2 4.2h11.6v2.2l-5.8 5.4 5.8 5.4v2.6H6.2v-2h8l-4.9-4.4 4.9-4.6h-8z"/>'),
  chip: S('<rect x="7.6" y="7.6" width="8.8" height="8.8" rx="2"/><path d="M9.6 2.6v3M14.4 2.6v3M9.6 18.4v3M14.4 18.4v3M2.6 9.6h3M2.6 14.4h3M18.4 9.6h3M18.4 14.4h3"/>'),
  list: S('<path d="M4.2 6.4h15.6M4.2 12h15.6M4.2 17.6h9.6"/>'),
  toc: S('<path d="M4.2 6.4h15.6M4.2 12h10.2M4.2 17.6h13"/>'),
  help: S('<circle cx="12" cy="12" r="8.4"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.6-2.4 1.9-2.4 3.4"/><path d="M12 16.6h.01"/>'),
  research: S('<path d="M9.2 3.4h5.6M10.3 3.4v6.3l-4.6 8a2 2 0 0 0 1.7 3h9.2a2 2 0 0 0 1.7-3l-4.6-8V3.4"/>'),
  translate: S('<path d="M3.6 6.2h8.8M8 4.2v2M9.9 6.2c0 4-2.6 7.4-6.3 9"/><path d="M5.6 10.4c1.3 2.4 3.5 4.3 6.2 5.2"/><path d="M12.6 19.8l3.4-8.6 3.4 8.6M13.9 16.9h4.2"/>'),
  settings: S('<path d="M10.11 2.28 L13.89 2.28 L13.54 4.86 L15.95 5.86 L17.54 3.79 L20.21 6.46 L18.14 8.05 L19.14 10.46 L21.72 10.11 L21.72 13.89 L19.14 13.54 L18.14 15.95 L20.21 17.54 L17.54 20.21 L15.95 18.14 L13.54 19.14 L13.89 21.72 L10.11 21.72 L10.46 19.14 L8.05 18.14 L6.46 20.21 L3.79 17.54 L5.86 15.95 L4.86 13.54 L2.28 13.89 L2.28 10.11 L4.86 10.46 L5.86 8.05 L3.79 6.46 L6.46 3.79 L8.05 5.86 L10.46 4.86 Z"/><circle cx="12" cy="12" r="3.1"/>'),
  sun: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.9v2.4M12 18.7v2.4M4.7 4.7l1.7 1.7M17.6 17.6l1.7 1.7M2.9 12h2.4M18.7 12h2.4M4.7 19.3l1.7-1.7M17.6 6.4l1.7-1.7"/>'),
  moon: S('<path d="M20.3 14.1A8.5 8.5 0 0 1 9.9 3.7 8.5 8.5 0 1 0 20.3 14.1Z"/>'),
  auto: S('<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/>'),
  quote: S('<path d="M7 7.5h3.6v3.4c0 3-1.6 5.1-4.2 5.8l-.6-1.6c1.4-.5 2-1.3 2-2.6H7zM13.4 7.5H17v3.4c0 3-1.6 5.1-4.2 5.8l-.6-1.6c1.4-.5 2-1.3 2-2.6h-.8z"/>'),
  shield: S('<path d="M12 3.4 19 6.2v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10v-5z"/><path d="m9.2 11.9 2 2 3.6-3.6"/>'),
  pencil: S('<path d="m8.4 15.6 8.6-8.6a2.6 2.6 0 0 1 3.7 3.7l-8.6 8.6-4.6.9z"/><path d="m14.6 9.4 3.7 3.7"/>'),
  send: S('<path d="M4.3 11.9 20 4.4l-4.3 15.5-4.1-6.2z"/><path d="m11.6 13.7 4.2-4.2"/>'),
  keyboard: S('<rect x="2.9" y="6.4" width="18.2" height="11.2" rx="2.6"/><path d="M6.4 10h.01M9.6 10h.01M12.8 10h.01M16 10h.01M6.4 13.4h.01M9.6 13.4h.01M12.8 13.4h.01M16 13.4h.01M8.6 16.2h6.8"/>'),
  lock: S('<rect x="4.4" y="10.2" width="15.2" height="10.4" rx="2.6"/><path d="M8 10.2V7.4a4 4 0 0 1 8 0v2.8"/>'),
  image: S('<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.8"/><circle cx="8.9" cy="9.7" r="1.5"/><path d="m4.4 17.4 4.9-4.6 3.6 3.3 3-2.6 4.7 4.1"/>'),
  network: S('<circle cx="12" cy="5.4" r="2.4"/><circle cx="5.4" cy="18" r="2.4"/><circle cx="18.6" cy="18" r="2.4"/><path d="M10.6 7.6 6.8 15.8M13.4 7.6l3.8 8.2M7.8 18h8.4"/>'),
  pin: S('<path d="M12 20.6s6.4-5.9 6.4-10.6a6.4 6.4 0 1 0-12.8 0C5.6 14.7 12 20.6 12 20.6Z"/><circle cx="12" cy="9.8" r="2.4"/>'),
  sliders: S('<path d="M4.4 7.4h8.2M16.6 7.4h3M4.4 16.6h3M11.4 16.6h8.2"/><circle cx="14.6" cy="7.4" r="2.2"/><circle cx="9.4" cy="16.6" r="2.2"/>'),
  chevronDown: S('<path d="m6.6 9.4 5.4 5.4 5.4-5.4"/>'),
  doc: S('<path d="M6.2 3.6h7.2l4.4 4.4v12.4H6.2z"/><path d="M13.2 3.8v4.4h4.4M9.2 12h5.6M9.2 15.6h5.6"/>'),
  columns: S('<rect x="3.4" y="4.6" width="7.4" height="14.8" rx="2"/><rect x="13.2" y="4.6" width="7.4" height="14.8" rx="2"/>'),
  grid: S('<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>'),
};

/** Placeholder mark for a card with no picture. */
export const PLACEHOLDER_MARK = `<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#173b32"/><rect x="6.6" y="6.6" width="26.8" height="26.8" rx="6.2" fill="none" stroke="#f5f0e6" stroke-opacity=".32" stroke-width="1.3"/><g fill="none" stroke="#f5f0e6" stroke-width="2.7" stroke-linecap="round"><path d="M10.2 16.5c2.85-3.5 5.7-3.5 8.55 0s5.7 3.5 8.55 0"/><path d="M12.4 23.5c2.85-3.5 5.7-3.5 8.55 0s5.7 3.5 8.55 0"/></g></svg>`;

export function icon(name, extra = '') {
  // `extra` is written into the root <svg> tag so a caller can add a class or a
  // data attribute. It used to be accepted and then dropped, so every caller
  // that passed one silently got an unclassed icon back.
  const svg = ICONS[name] || '';
  if (!svg && name) {
    // A missing name used to return an empty string with no signal anywhere,
    // which is how an icon silently disappears from a page. In development
    // that is now a console warning; in production it stays quiet.
    const dev = typeof location !== 'undefined'
      && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (dev) console.warn(`icon(): no glyph registered as "${name}"`);
  }
  if (!svg || !extra) return svg;
  return svg.replace('<svg ', `<svg ${String(extra).trim()} `);
}
