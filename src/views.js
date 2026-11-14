/* The views: home, answer, explore, on-this-day, library, sources, saved.
 *
 * Each one returns a DOM node and takes the data it needs. The router owns the
 * URL and the history; nothing here touches location.
 */

import { h, esc, clip, wikiUrl, hostOf, KEY, read, write, LANGS } from './core.js';
import { searchTitles, fetchArticle, summary, onThisDay, mostRead, featuredFeed, leadImage, wikidataFacts, commonsImages, langLinks, translatedTitle, CATEGORIES } from './wiki.js';
import { composeAnswer, answerText } from './answer.js';

const DEPTH_LABEL = { quick: 'Quick answer', detailed: 'Detailed', deep: 'Deep dive' };

/* ── shared pieces ──────────────────────────────────────────────────────── */

export function askBox({ value = '', onSubmit, label = 'Ask a question' }) {
  const input = h('input', {
    type: 'search', name: 'q', value, placeholder: 'Ask anything — Chandrayaan-3, UPI, Vedas…',
    'aria-label': label, autocomplete: 'off', enterkeyhint: 'search',
  });
  const form = h('form', { class: 'em-ask', role: 'search' },
    input,
    h('button', { class: 'em-ask-go', type: 'submit', 'aria-label': 'Ask' },
      h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m19.5 19.5-4.3-4.3"/></svg>' })));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query) onSubmit(query);
  });
  return form;
}

function chips(items, onPick) {
  const row = h('div', { class: 'em-chips' });
  for (const item of items) {
    row.append(h('button', { class: 'em-chip', type: 'button', text: item, onClick: () => onPick(item) }));
  }
  return row;
}

function sectionHead(title, note) {
  return h('div', { class: 'em-section-head' }, h('h2', { text: title }), note ? h('p', { text: note }) : null);
}

function sourceList(sources) {
  const list = h('ol', { class: 'em-source-list' });
  for (const source of sources) {
    list.append(h('li', {},
      h('a', { class: 'em-source', href: source.url, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'n', text: String(source.n) }),
        h('span', { class: 't', text: source.title }),
        h('span', { class: 'h', text: hostOf(source.url) || 'wikipedia.org' }))));
  }
  return h('section', { class: 'em-sources' }, h('h2', { text: 'Sources' }), list);
}

/* ── home ───────────────────────────────────────────────────────────────── */

export function homeView({ go, lang, articles = [], feed = null }) {
  const wrap = h('div', {});
  const hero = h('section', { class: 'em-hero' },
    h('div', { class: 'em-hero-eyebrow' }, h('span', { class: 'em-dot' }), 'Veridell'),
    h('h1', { html: 'Every answer, <em>with its source</em>.' }),
    h('p', { text: 'Ask in your own words. The answer is built from Wikipedia and Wikidata, and every sentence can be traced back to the article it came from.' }),
    askBox({ onSubmit: (query) => go(`#/ask?q=${encodeURIComponent(query)}`) }),
    chips(['Chandrayaan-3', 'Unified Payments Interface', 'Vedas', 'Black hole', 'Ayurveda', 'Chess'],
      (query) => go(`#/ask?q=${encodeURIComponent(query)}`)));
  wrap.append(hero);

  const categories = h('div', { class: 'em-grid' });
  for (const category of CATEGORIES) {
    categories.append(h('a', {
      class: 'em-card',
      href: `#/library?q=${encodeURIComponent(category.query)}`,
      onclick: (event) => { event.preventDefault(); go(`#/library?q=${encodeURIComponent(category.query)}`); },
    }, h('strong', { text: category.label }), h('span', { text: `Articles about ${category.query}` })));
  }
  wrap.append(h('section', { class: 'em-panel' }, sectionHead('Browse by subject'), categories));

  // ── the front page, as Wikimedia publishes it ─────────────────────────
  // The article of the day is always shown. When the day's article has no
  // picture the card keeps its shape with a drawn panel behind the title, so
  // the front page looks the same every day and never has a hole in it.
  if (feed?.articleOfTheDay) {
    const aotd = feed.articleOfTheDay;
    const card = h('a', {
      class: 'em-aotd',
      href: aotd.url || `#/article/${encodeURIComponent(aotd.title)}`,
      onclick: (event) => { event.preventDefault(); go(`#/article/${encodeURIComponent(aotd.title)}`); },
    },
      h('span', { class: 'em-aotd-media' },
        aotd.image
          ? h('img', { src: aotd.image, alt: '', loading: 'lazy', decoding: 'async' })
          : h('span', { class: 'em-aotd-blank', 'aria-hidden': 'true' })),
      h('span', { class: 'em-aotd-body' },
        h('span', { class: 'em-eyebrow', text: 'Article of the day' }),
        h('strong', { text: aotd.title }),
        h('span', { class: 'em-aotd-extract', text: clip(aotd.extract, 320) }),
        h('span', { class: 'em-aotd-more', text: 'Read the breakdown →' })));
    wrap.append(h('section', { class: 'em-panel' }, card));
  }

  if (feed?.pictureOfTheDay?.image) {
    const potd = feed.pictureOfTheDay;
    const figure = h('figure', { class: 'em-potd' },
      h('img', { src: potd.image, alt: potd.caption || potd.title, loading: 'lazy', decoding: 'async' }),
      h('figcaption', {},
        h('span', { class: 'em-eyebrow', text: 'Picture of the day' }),
        h('strong', { text: potd.title.replace(/^File:/, '').replace(/\.(jpe?g|png|svg|gif)$/i, '') }),
        potd.caption ? h('span', { class: 'em-potd-caption', text: clip(potd.caption, 220) }) : null,
        potd.artist ? h('span', { class: 'em-potd-credit', text: `Image: ${clip(potd.artist, 90)}` }) : null));
    wrap.append(h('section', { class: 'em-panel' }, sectionHead('Picture of the day', 'From Wikimedia Commons'), figure));
  }

  const written = h('div', { class: 'em-grid' });
  for (const article of articles) {
    written.append(h('a', {
      class: 'em-card',
      href: `/articles/${article.slug}/`,
      onclick: (event) => { event.preventDefault(); go(`#/article/${article.slug}`); },
    }, h('strong', { text: article.title }), h('span', { text: clip(article.description || article.lead, 110) })));
  }
  if (written.children.length) {
    wrap.append(h('section', { class: 'em-panel em-written' }, sectionHead('Written here', 'Complete pages, not summaries'), written));
  }

  const readRows = feed?.mostRead || [];
  if (readRows.length) {
    const list = h('ol', { class: 'em-readlist' });
    readRows.forEach((row, index) => {
      list.append(h('li', {},
        h('a', {
          class: 'em-read',
          href: `#/article/${encodeURIComponent(row.title)}`,
          onclick: (event) => { event.preventDefault(); go(`#/article/${encodeURIComponent(row.title)}`); },
        },
          h('span', { class: 'em-read-n', text: String(index + 1) }),
          row.image ? h('img', { class: 'em-read-thumb', src: row.image, alt: '', loading: 'lazy', decoding: 'async' }) : null,
          h('span', { class: 'em-read-body' },
            h('strong', { text: row.title }),
            h('span', { text: clip(row.extract, 120) })),
          h('span', { class: 'em-read-views', text: row.views ? `${(row.views / 1000).toFixed(0)}k reads` : '' }))));
    });
    wrap.append(h('section', { class: 'em-panel' }, sectionHead('Most read yesterday', 'By pageviews, from Wikimedia'), list));
  }

  return wrap;
}

/* ── the answer ─────────────────────────────────────────────────────────── */

const TRANSLATE_TO = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
];

export function answerView(answer, { question = '', depth = 'detailed', onDepth, go, onTranslate }) {
  const wrap = h('article', { class: 'em-answer em-column' });

  const badge = h('span', { class: 'em-badge', text: answer.translated ? 'Translated' : 'Source-backed' });
  wrap.append(h('div', { class: 'em-answer-head' },
    badge,
    h('span', { class: 'em-meta-note', text: question ? `Answering “${clip(question, 70)}”` : 'From the article' })));

  if (answer.image?.src) {
    wrap.append(h('figure', { class: 'em-hero-figure' },
      h('img', { src: answer.image.src, alt: '', loading: 'eager', decoding: 'async' }),
      answer.image.caption ? h('figcaption', { text: answer.image.caption }) : null));
  }

  wrap.append(h('h1', { text: answer.title }));

  const depthBar = h('div', { class: 'em-depth', role: 'group', 'aria-label': 'Answer depth' });
  for (const [key, label] of Object.entries(DEPTH_LABEL)) {
    const button = h('button', { type: 'button', text: label, 'aria-pressed': String(key === depth) });
    button.addEventListener('click', () => onDepth?.(key));
    depthBar.append(button);
  }
  wrap.append(depthBar);

  if (answer.lead) wrap.append(h('p', { class: 'em-lead', text: answer.lead }));

  if (answer.points?.length) {
    const points = h('ul', { class: 'em-points' });
    for (const point of answer.points) points.append(h('li', { text: point }));
    wrap.append(points);
  }

  for (const topic of answer.topics || []) {
    const block = h('section', { class: 'em-topic' }, h('h2', { text: topic.heading }));
    for (const paragraph of topic.paragraphs) block.append(h('p', { text: paragraph }));
    wrap.append(block);
  }

  // ── pictures, from Commons ────────────────────────────────────────────
  if (answer.images?.length) {
    // One picture is the subject and is centred; several are a set and run in a
    // single horizontal line, so the article never gets pushed down the page.
    const strip = h('div', { class: `em-pics${answer.images.length === 1 ? ' em-pics--single' : ''}` });
    for (const image of answer.images) {
      strip.append(h('a', {
        class: 'em-pic', href: image.page || answer.url, target: '_blank', rel: 'noopener noreferrer',
        title: [image.title, image.credit, image.licence].filter(Boolean).join(' · '),
      },
        h('img', { src: image.src, alt: image.title, loading: 'lazy', decoding: 'async' }),
        h('span', { class: 'em-pic-credit', text: [image.credit, image.licence].filter(Boolean).join(' · ') })));
    }
    wrap.append(h('section', { class: 'em-sources em-pictures' },
      h('h2', { text: answer.images.length === 1 ? 'Picture' : 'Pictures' }),
      strip,
      h('p', { class: 'em-meta-note', text: 'Each picture opens its file page on Wikimedia Commons, where its licence is recorded.' })));
  }

  // ── facts, from Wikidata ──────────────────────────────────────────────
  if (answer.facts?.facts?.length) {
    const rows = h('dl', { class: 'em-facts' });
    for (const fact of answer.facts.facts) {
      rows.append(h('dt', { text: fact.label }));
      rows.append(h('dd', { text: fact.value }));
    }
    wrap.append(h('section', { class: 'em-sources' },
      h('h2', { text: 'Facts' }),
      rows,
      h('p', { class: 'em-meta-note' },
        'Structured data from ',
        h('a', { href: answer.facts.url, target: '_blank', rel: 'noopener noreferrer', text: `Wikidata ${answer.facts.id}` }),
        answer.facts.description ? ` — ${answer.facts.description}` : '')));
  }

  // ── every service this answer used, and where to read the original ─────
  if (answer.url) {
    const list = [{ n: 1, title: `${answer.title} — Wikipedia`, url: answer.url }];
    if (answer.facts?.url) list.push({ n: 2, title: `Wikidata item ${answer.facts.id}`, url: answer.facts.url });
    if (answer.commonsUrl) list.push({ n: 3, title: 'Images on Wikimedia Commons', url: answer.commonsUrl });
    wrap.append(sourceList(list));
    wrap.append(h('p', { class: 'em-meta-note' },
      'Text: CC BY-SA 4.0, by the Wikipedia community. Facts: CC0, from Wikidata. Pictures: the licence on each file page.'));
  }

  if (onTranslate) {
    const row = h('div', { class: 'em-translate' },
      h('span', { class: 'em-meta-note', text: 'Read in' }));
    for (const lang of TRANSLATE_TO) {
      const button = h('button', {
        type: 'button',
        class: `em-lang-chip${lang.code === (answer.lang || 'en') ? ' is-on' : ''}`,
        text: lang.label,
        onClick: () => onTranslate(lang.code),
      });
      row.append(button);
    }
    wrap.append(row);
  }

  const actions = h('div', { class: 'em-actions' });
  const copy = h('button', { type: 'button', text: 'Copy as Markdown' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(answerText(answer));
      copy.textContent = 'Copied';
    } catch { copy.textContent = 'Copy blocked'; }
  });
  actions.append(copy);

  const save = h('button', { type: 'button', text: 'Save' });
  save.addEventListener('click', () => {
    const saved = read(KEY.saved, []);
    if (!saved.some((row) => row.url === answer.url && row.title === answer.title)) {
      saved.unshift({ title: answer.title, url: answer.url, question, at: Date.now() });
      write(KEY.saved, saved.slice(0, 100));
    }
    save.textContent = 'Saved';
  });
  actions.append(save);
  wrap.append(actions);

  const follow = h('div', { class: 'em-follow' });
  for (const idea of [`What is the history of ${answer.title}?`, `Why does ${answer.title} matter?`]) {
    follow.append(h('button', { type: 'button', text: idea, onClick: () => go(`#/ask?q=${encodeURIComponent(idea)}`) }));
  }
  wrap.append(follow);
  return wrap;
}

/* ── loading an answer ──────────────────────────────────────────────────── */

export async function loadAnswer({ question, title = '', depth = 'detailed', lang = 'en', signal }) {
  const target = title || (await searchTitles(question, lang, 5, signal))[0]?.title;
  if (!target) throw new Error('nothing-found');

  const article = await fetchArticle(target, lang, signal);
  const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;

  /* Everything else is asked for at the same time: the lead picture, the
   * Commons pictures, the Wikidata facts and the language editions. Each one is
   * allowed to fail on its own — a page missing its facts is still a page, and
   * a page that waits for four services is a slow one. */
  const [picture, images, facts, links] = await Promise.all([
    leadImage(article.title, lang, signal).catch(() => null),
    commonsImages(article.title, lang, signal).catch(() => []),
    wikidataFacts(article.title, lang, signal).catch(() => null),
    langLinks(article.title, lang, signal).catch(() => []),
  ]);

  return {
    answer: {
      ...composeAnswer({ title: article.title, html: article.html, question, depth, url }),
      image: picture,
      images: images.slice(0, 6),
      facts,
      commonsUrl: images.length ? `https://commons.wikimedia.org/wiki/Special:Search?search=${encodeURIComponent(article.title)}` : '',
      lang,
      languages: links,
    },
    alternatives: [],
  };
}

/** The same article in another language, when that edition has it. */
export async function loadTranslated({ title, from = 'en', to, depth = 'detailed', question = '', signal }) {
  const translated = await translatedTitle(title, to, from, signal);
  if (!translated) return null;
  const article = await fetchArticle(translated, to, signal);
  const url = `https://${to}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;
  const [picture, facts] = await Promise.all([
    leadImage(article.title, to, signal).catch(() => null),
    wikidataFacts(article.title, to, signal).catch(() => null),
  ]);
  return {
    ...composeAnswer({ title: article.title, html: article.html, question, depth, url }),
    image: picture,
    facts,
    lang: to,
    translated: true,
    originalTitle: title,
  };
}

export function loadingView(text = 'Reading the article…') {
  return h('div', { class: 'em-page em-column' },
    h('p', { class: 'em-thinking', html: `<i></i><i></i><i></i><span>${esc(text)}</span>` }));
}

export function noteView({ title, body, action }) {
  const wrap = h('div', { class: 'em-page em-column' }, h('h1', { text: title }));
  if (body) wrap.append(h('p', { text: body }));
  if (action) wrap.append(h('p', {}, h('button', { class: 'em-chip', type: 'button', text: action.label, onClick: action.run })));
  return wrap;
}

/* ── explore, today, library, sources, saved ────────────────────────────── */

export function exploreView({ go, lang }) {
  const wrap = h('div', { class: 'em-page em-column' }, h('h1', { text: 'Explore' }),
    h('p', { class: 'em-sub', text: 'Subjects, the day in history, and what everyone else was reading yesterday.' }));

  const grid = h('div', { class: 'em-grid' });
  for (const category of CATEGORIES) {
    grid.append(h('a', {
      class: 'em-card', href: `#/library?q=${encodeURIComponent(category.query)}`,
      onclick: (event) => { event.preventDefault(); go(`#/library?q=${encodeURIComponent(category.query)}`); },
    }, h('strong', { text: category.label }), h('span', { text: `Articles about ${category.query}` })));
  }
  wrap.append(grid);

  const feed = h('div', { class: 'em-grid em-grid--async' });
  wrap.append(h('section', { class: 'em-section' }, sectionHead('Most read yesterday'), feed));
  mostRead(lang).then((rows) => {
    for (const row of rows) {
      feed.append(h('a', {
        class: 'em-card', href: `#/article/${encodeURIComponent(row.title)}`,
        onclick: (event) => { event.preventDefault(); go(`#/article/${encodeURIComponent(row.title)}`); },
      }, h('strong', { text: row.title }), h('span', { text: clip(row.extract, 110) })));
    }
  }).catch(() => {});
  return wrap;
}

export function todayView({ go, lang, date = new Date() }) {
  const wrap = h('div', { class: 'em-page em-column' });
  wrap.append(h('h1', { text: 'On this day' }));
  wrap.append(h('p', { class: 'em-sub', text: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) }));

  const groups = [['events', 'Events'], ['births', 'Born'], ['deaths', 'Died']];
  for (const [key, label] of groups) {
    const box = h('section', { class: 'em-section' }, sectionHead(label));
    wrap.append(box);
    onThisDay(date.getMonth() + 1, date.getDate(), lang)
      .then((data) => {
        const rows = data[key] || [];
        if (!rows.length) { box.remove(); return; }
        const list = h('div', { class: 'em-grid' });
        for (const row of rows) {
          list.append(h('a', {
            class: 'em-card', href: row.title ? `#/article/${encodeURIComponent(row.title)}` : '#/today',
            onclick: (event) => {
              if (!row.title) return;
              event.preventDefault();
              go(`#/article/${encodeURIComponent(row.title)}`);
            },
          }, h('strong', { text: `${row.year} · ${row.title || 'History'}` }), h('span', { text: clip(row.text, 140) })));
        }
        box.append(list);
      })
      .catch(() => box.remove());
  }
  return wrap;
}

export async function libraryView({ query = '', go, lang }) {
  const wrap = h('div', { class: 'em-page em-column' }, h('h1', { text: 'Library' }),
    h('p', { class: 'em-sub', text: 'One search across the encyclopaedia, Wikiquote and Wikisource.' }));
  wrap.append(askBox({ value: query, onSubmit: (next) => go(`#/library?q=${encodeURIComponent(next)}`) }));

  if (!query) return wrap;
  const list = h('div', { class: 'em-grid' });
  wrap.append(h('section', { class: 'em-section' }, sectionHead(`Results for “${clip(query, 50)}”`), list));

  const sources = [
    { lang, project: 'wikipedia', label: 'Wikipedia' },
    { lang, project: 'wikiquote', label: 'Wikiquote' },
    { lang, project: 'wikisource', label: 'Wikisource' },
  ];
  for (const source of sources) {
    try {
      const url = `https://${source.lang}.${source.project}.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=6&srsearch=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json();
      for (const row of data?.query?.search || []) {
        const href = `https://${source.lang}.${source.project}.org/wiki/${encodeURIComponent(String(row.title).replace(/ /g, '_'))}`;
        list.append(h('a', { class: 'em-card', href, target: '_blank', rel: 'noopener noreferrer' },
          h('strong', { text: String(row.title) }),
          h('span', { text: `${source.label} · ${clip(String(row.snippet || '').replace(/<[^>]+>/g, ''), 120)}` })));
      }
    } catch { /* one source being down must not empty the page */ }
  }
  if (!list.children.length) {
    wrap.append(h('p', { text: 'Nothing matched. Try a broader word, or ask the question in your own words.' }));
  }
  return wrap;
}

export function sourcesView() {
  const wrap = h('div', { class: 'em-page em-column' }, h('h1', { text: 'Sources' }),
    h('p', { class: 'em-sub', text: 'Where every sentence on this site comes from, and under which licence.' }));

  const rows = [
    ['Wikipedia', 'Article text and images, under CC BY-SA 4.0. Every answer links back to the article it was built from.', 'https://www.wikipedia.org/'],
    ['Wikidata', 'Structured facts — dates, people, identifiers — released under CC0 1.0.', 'https://www.wikidata.org/'],
    ['Wikimedia Commons', 'Images and their licence records, each shown with the file it belongs to.', 'https://commons.wikimedia.org/'],
    ['Wikiquote and Wikisource', 'Quotations and public-domain texts, read directly from their own APIs.', 'https://www.wikiquote.org/'],
  ];
  for (const [title, body, url] of rows) {
    wrap.append(h('section', { class: 'em-section' }, h('h2', { text: title }), h('p', { text: body }),
      h('p', {}, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: url.replace('https://', '') }))));
  }
  wrap.append(h('section', { class: 'em-section' }, h('h2', { text: 'What this site is not' }),
    h('p', { text: 'Veridell is an independent reader. It is not affiliated with or endorsed by the Wikimedia Foundation, and it does not claim that a summary replaces the article it came from.' })));
  return wrap;
}


/* ── credits ────────────────────────────────────────────────────────────── */

/**
 * Who made this, and who made the things it is made of.
 *
 * A site that answers from other people's work owes them a page that says so:
 * the editors who wrote the articles, the photographers whose pictures are
 * shown, the projects whose data and infrastructure carry the rest, and the
 * licence each one is used under. This is that page.
 */
export function creditsView({ go }) {
  const row = (name, body, href) => h('li', { class: 'em-credit' },
    h('span', { class: 'em-credit-name', text: name }),
    h('span', { class: 'em-credit-body', text: body }),
    href ? h('a', { class: 'em-credit-link', href, target: '_blank', rel: 'noopener noreferrer', text: 'Open ↗' }) : null);

  const list = (items) => h('ul', { class: 'em-credit-list' }, ...items.map((item) => row(...item)));

  return h('div', { class: 'em-page em-column' },
    h('h1', { text: 'Credits' }),
    h('p', { class: 'em-sub', text: 'Everything here was written, photographed, catalogued or hosted by someone. This page names them.' }),

    h('h2', { text: 'The site' }),
    h('p', {}, 'Built and maintained by ', h('strong', { text: 'Bhola Kumar' }),
      ' — design, code, copy and the decisions about what an answer should look like. The source is public: ',
      h('a', { href: 'https://github.com/galeoindus/veridell', target: '_blank', rel: 'noopener noreferrer', text: 'github.com/galeoindus/veridell' }), '.'),
    h('p', { class: 'em-muted', text: 'Code: MIT licence. Use it, fork it, run your own.' }),

    h('h2', { text: 'The knowledge' }),
    h('p', { text: 'Every sentence that carries a citation was written by a volunteer, not by this site. Those volunteers are the reason it works.' }),
    list([
      ['Wikipedia', 'Article text, in twelve languages, by the Wikipedia community. Reused under CC BY-SA 4.0; each answer links to the article it came from.', 'https://www.wikipedia.org/'],
      ['Wikimedia Commons', 'Pictures and their licence records. The picture of the day is shown with its photographer and licence.', 'https://commons.wikimedia.org/'],
      ['Wikidata', 'Structured facts — dates, people, identifiers — released under CC0 1.0.', 'https://www.wikidata.org/'],
      ['Wikiquote and Wikisource', 'Quotations and public-domain texts, read from their own APIs.', 'https://www.wikiquote.org/'],
    ]),

    h('h2', { text: 'The infrastructure' }),
    list([
      ['Cloudflare Pages', 'Serves the site and runs the small functions behind the chat.', 'https://www.cloudflare.com/'],
      ['Cloudflare Workers AI', 'The free model allocation that answers chat questions by default.', 'https://developers.cloudflare.com/workers-ai/'],
      ['OpenRouter', 'Optional. Used only when an operator connects a key, and free models only unless they say otherwise.', 'https://openrouter.ai/'],
      ['Ollama', 'Optional. Runs a model on the reader’s own machine, so the question never leaves the device.', 'https://ollama.com/'],
      ['Wikimedia REST API', 'Search, article text, the front-page feed and pageviews.', 'https://api.wikimedia.org/'],
    ]),

    h('h2', { text: 'The machine-written part' }),
    h('p', { text: 'A language model writes the chat answers. It is told to use only the passages it is given, to cite them, and to say so when they do not contain the answer. When no article matches, the answer is labelled “General answer” and carries no citation — because there is nothing to cite.' }),

    h('h2', { text: 'Licences' }),
    h('ul', { class: 'em-plain' },
      h('li', { text: 'Site code — MIT.' }),
      h('li', { text: 'Wikipedia text — CC BY-SA 4.0.' }),
      h('li', { text: 'Wikidata — CC0 1.0.' }),
      h('li', { text: 'Commons images — the licence shown with each picture.' })),

    h('h2', { text: 'Corrections' }),
    h('p', { text: 'If something here is wrong, the article it came from is the authority — open it and fix it there, and the next reader gets the better answer too.' }),
    h('p', {}, h('button', { class: 'em-chip', type: 'button', text: 'Back to the front page', onClick: () => go('#/') })));
}

export function savedView({ go }) {
  const saved = read(KEY.saved, []);
  const wrap = h('div', { class: 'em-page em-column' }, h('h1', { text: 'Saved' }),
    h('p', { class: 'em-sub', text: 'Kept in this browser only — no account, no sync.' }));
  if (!saved.length) {
    wrap.append(h('p', { text: 'Nothing saved yet. Use Save on any answer.' }));
    return wrap;
  }
  const list = h('div', { class: 'em-grid' });
  for (const row of saved) {
    list.append(h('a', {
      class: 'em-card', href: row.url || '#/',
      onclick: (event) => {
        if (!row.url) return;
        event.preventDefault();
        go(`#/article/${encodeURIComponent(row.title)}`);
      },
    }, h('strong', { text: row.title }), h('span', { text: row.question || 'Saved answer' })));
  }
  wrap.append(list);
  return wrap;
}

export { LANGS, esc, clip, wikiUrl };
