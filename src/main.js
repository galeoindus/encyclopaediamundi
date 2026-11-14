/* The router and the shell.
 *
 * One document, hash routes, no framework. A route is a function that returns
 * a node; the router owns the URL, the scroll position and the focus ring, and
 * nothing else in the app reads location.
 */

import { h, KEY, read, write, initTheme, paintTheme, LANGS, MARK, esc, clip } from './core.js';
import {
  homeView, answerView, loadAnswer, loadingView, noteView,
  exploreView, todayView, libraryView, sourcesView, savedView,
} from './views.js';

const view = document.getElementById('view');
const bar = document.getElementById('bar');

const state = {
  depth: read(KEY.depth, 'detailed'),
  lang: read(KEY.lang, 'en'),
  run: 0,
};

/* ── the header ─────────────────────────────────────────────────────────── */

const NAV = [
  ['#/', 'Home'],
  ['#/explore', 'Explore'],
  ['#/today', 'On this day'],
  ['#/library', 'Library'],
  ['#/sources', 'Sources'],
  ['/chat/', 'Amigo'],
];

function paintBar() {
  bar.replaceChildren(
    h('div', { class: 'em-bar-in' },
      h('a', { class: 'em-brand', href: '#/', 'aria-label': 'Encyclopaedia Mundi home' },
        h('span', { class: 'em-brand-mark', html: MARK }),
        h('span', { class: 'em-brand-word', text: 'Encyclopaedia Mundi' })),
      h('nav', { class: 'em-nav', 'aria-label': 'Primary' },
        ...NAV.map(([href, label]) => h('a', { href, text: label }))),
      h('label', { class: 'em-sr', for: 'em-lang', text: 'Source language' }),
      h('select', {
        id: 'em-lang',
        class: 'em-icon-btn',
        style: 'width:auto;padding:0 10px;font:inherit;font-size:13px',
        'aria-label': 'Source language',
        onchange: (event) => {
          state.lang = event.target.value;
          write(KEY.lang, state.lang);
          render();
        },
      }, ...LANGS.map((lang) => new Option(lang.label, lang.code))),
      h('button', { class: 'em-icon-btn', type: 'button', 'data-theme-toggle': '', 'aria-label': 'Switch theme',
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M20.3 14.1A8.5 8.5 0 0 1 9.9 3.7 8.5 8.5 0 1 0 20.3 14.1Z"/></svg>' })));

  const select = bar.querySelector('#em-lang');
  if (select) select.value = state.lang;
  paintTheme(document.documentElement.dataset.theme || read(KEY.theme, ''));
  for (const link of bar.querySelectorAll('.em-nav a')) {
    const target = link.getAttribute('href');
    if (target === location.hash || (target === '#/' && (location.hash === '' || location.hash === '#'))) {
      link.setAttribute('aria-current', 'page');
    }
  }
}

/* ── routing ────────────────────────────────────────────────────────────── */

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  return { path: path || '/', params };
}

function mount(node) {
  view.replaceChildren(node);
  window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
  document.title = document.title.replace(/^.*?— /, '') || document.title;
}

async function render() {
  const run = ++state.run;
  const { path, params } = parse();
  paintBar();

  if (path === '/' || path === '') {
    document.title = 'Encyclopaedia Mundi — every answer, with its source';
    mount(homeView({ go, lang: state.lang }));
    return;
  }

  if (path === '/ask') {
    const question = (params.get('q') || '').trim();
    if (!question) { go('#/'); return; }
    document.title = `${clip(question, 60)} — Encyclopaedia Mundi`;
    mount(loadingView('Reading the article…'));
    try {
      const { answer } = await loadAnswer({ question, depth: state.depth, lang: state.lang });
      if (run !== state.run) return;
      mount(answerView(answer, {
        question,
        depth: state.depth,
        go,
        onDepth: (depth) => {
          state.depth = depth;
          write(KEY.depth, depth);
          go(`#/ask?q=${encodeURIComponent(question)}`);
        },
      }));
      history.replaceState(null, '', `#/article/${encodeURIComponent(answer.title)}`);
    } catch (error) {
      if (run !== state.run) return;
      mount(noteView({
        title: 'Nothing on that yet',
        body: error?.message === 'nothing-found'
          ? 'No article matched that question. Try a shorter phrase, or ask it in another language.'
          : 'The article could not be read just now. Check the connection and try again.',
        action: { label: 'Ask Amigo instead', run: () => { location.href = `/chat/?q=${encodeURIComponent(question)}`; } },
      }));
    }
    return;
  }

  if (path.startsWith('/article/')) {
    const title = decodeURIComponent(path.slice('/article/'.length));
    document.title = `${title.replace(/_/g, ' ')} — Encyclopaedia Mundi`;
    mount(loadingView('Reading the article…'));
    try {
      const { answer } = await loadAnswer({ question: title.replace(/_/g, ' '), depth: state.depth, lang: state.lang });
      if (run !== state.run) return;
      mount(answerView(answer, {
        depth: state.depth,
        go,
        onDepth: (depth) => { state.depth = depth; write(KEY.depth, depth); render(); },
      }));
    } catch {
      if (run !== state.run) return;
      mount(noteView({ title: 'That article could not be opened', body: 'It may have been renamed. Try a search from the home page.' }));
    }
    return;
  }

  if (path === '/explore') { document.title = 'Explore — Encyclopaedia Mundi'; mount(exploreView({ go, lang: state.lang })); return; }
  if (path === '/today') { document.title = 'On this day — Encyclopaedia Mundi'; mount(todayView({ go, lang: state.lang })); return; }
  if (path === '/sources') { document.title = 'Sources — Encyclopaedia Mundi'; mount(sourcesView()); return; }
  if (path === '/saved') { document.title = 'Saved — Encyclopaedia Mundi'; mount(savedView({ go })); return; }

  if (path === '/library') {
    const query = (params.get('q') || '').trim();
    document.title = 'Library — Encyclopaedia Mundi';
    mount(await libraryView({ query, go, lang: state.lang }));
    return;
  }

  document.title = 'Not found — Encyclopaedia Mundi';
  mount(noteView({
    title: 'That page does not exist',
    body: 'Every route lives on the home page: search a subject there, or open the library.',
    action: { label: 'Go home', run: () => go('#/') },
  }));
}

/* ── boot ───────────────────────────────────────────────────────────────── */

initTheme();
paintBar();
render();
window.addEventListener('hashchange', render);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
    event.preventDefault();
    document.querySelector('.em-ask input')?.focus();
  }
});
