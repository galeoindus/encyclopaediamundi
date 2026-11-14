#!/usr/bin/env node
/**
 * Build the crawlable pages.
 *
 * The app is one document behind a hash router, which a crawler cannot read.
 * So the pages that should be found are written here, as real HTML files, from
 * the article data in data/articles.json:
 *
 *   /articles/<slug>/   the article, in full, with its own head and JSON-LD
 *   /articles/          the index
 *   /topics/            every subject, grouped
 *   /questions/         the questions the site is built to answer
 *   /help/ /how-it-works/ /research/
 *   /sitemap.xml        generated from the files that exist, never typed by hand
 *
 * Run: node scripts/build-pages.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = process.env.SITE_ORIGIN || 'https://veridell.pages.dev';
const articles = JSON.parse(readFileSync(join(ROOT, 'data/articles.json'), 'utf8'));

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MARK = `<span class="em-brand-mark" aria-hidden="true"><svg viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="emMarkG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f7d63"/><stop offset="1" stop-color="#08302a"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="26" fill="url(#emMarkG)"/>
  <path d="M28 31 L48 66 L68 31" fill="none" stroke="#f7f3ea" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="48" cy="24.5" r="5.2" fill="#e0a06a"/>
</svg></span>`;

const NAV = `<nav class="em-nav" aria-label="Primary">
  <a href="/">Home</a><a href="/articles/">Articles</a><a href="/topics/">Topics</a>
  <a href="/questions/">Questions</a><a href="/help/">Help</a><a href="/chat/">Amigo</a>
</nav>`;

const FOOT = `<footer class="em-foot">
  <div class="em-foot-in">
    <div class="em-foot-col"><strong>Read</strong><a href="/articles/">Articles</a><a href="/topics/">Topics</a><a href="/#/library">Library</a><a href="/#/today">On this day</a></div>
    <div class="em-foot-col"><strong>About</strong><a href="/how-it-works/">How it works</a><a href="/help/">Help</a><a href="/#/sources">Sources</a><a href="/#/credits">Credits</a><a href="https://github.com/galeoindus/veridell" target="_blank" rel="noopener noreferrer">GitHub</a></div>
    <div class="em-foot-col"><strong>Talk</strong><a href="/chat/">Amigo chat</a><a href="/questions/">Questions</a><a href="/research/">Research desk</a></div>
  </div>
  <div class="em-foot-in"><p>Wikipedia text is available under CC BY-SA 4.0 and Wikidata under CC0 1.0. Veridell is an independent reader, not affiliated with or endorsed by the Wikimedia Foundation.</p></div>
</footer>`;

function shell({ title, description, path, body, jsonLd = '', noindex = false }) {
  const url = `${ORIGIN}${path}`;
  // Assets are addressed relative to the page, so the site works from the root
  // of a host, from a sub-folder, and from a plain file:// open alike. An
  // absolute "/styles/site.css" is the reason a page can arrive unstyled.
  const up = '../'.repeat(path.split('/').filter(Boolean).length);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta name="theme-color" content="#f7f3ea" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1512" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Veridell">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${up}assets/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${up}manifest.webmanifest">
<script src="${up}src/theme-boot.js"></script>
<link rel="stylesheet" href="${up}styles/site.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body data-page="static">
<a class="em-skip" href="#content">Skip to the content</a>
<header class="em-bar"><div class="em-bar-in">
  <a class="em-brand" href="/" aria-label="Veridell home">${MARK}<span class="em-brand-word">Veridell</span></a>
  ${NAV}
</div></header>
<main class="em-main" id="content">
${body}
</main>
${FOOT}
<script type="module" src="${up}src/static.js"></script>
</body>
</html>
`;
}

function write(path, html) {
  const file = join(ROOT, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

/* ── one article ────────────────────────────────────────────────────────── */

function articlePage(article) {
  const path = `/articles/${article.slug}/`;
  const toc = article.sections.map((section, index) => (
    `<li><a href="#s${index + 1}">${esc(section.heading)}</a></li>`
  )).join('');

  const sections = article.sections.map((section, index) => `
    <section class="em-topic" id="s${index + 1}">
      <h2>${esc(section.heading)}</h2>
      ${section.paras.map((para) => `<p>${esc(para)}</p>`).join('\n      ')}
    </section>`).join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description || article.lead,
    url: `${ORIGIN}${path}`,
    inLanguage: 'en',
    isBasedOn: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    publisher: { '@type': 'Organization', name: 'Veridell', url: `${ORIGIN}/` },
  });

  const body = `<article class="em-answer em-column">
  <div class="em-answer-head">
    <span class="em-badge">Article</span>
    <span class="em-meta-note">Built from Wikipedia · CC BY-SA 4.0</span>
  </div>
  <h1>${esc(article.title)}</h1>
  ${article.lead ? `<p class="em-lead">${esc(article.lead)}</p>` : ''}
  <ul class="em-toc">${toc}</ul>
  ${sections}
  <section class="em-sources">
    <h2>Source</h2>
    <ol class="em-source-list">
      <li><a class="em-source" href="https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">
        <span class="n">1</span><span class="t">${esc(article.title)} — Wikipedia</span><span class="h">wikipedia.org</span></a></li>
    </ol>
  </section>
  <div class="em-follow">
    <a class="em-chip" href="/chat/?q=${encodeURIComponent(`Explain ${article.title} in simple words`)}">Ask Amigo about this</a>
    <a class="em-chip" href="/articles/">All articles</a>
  </div>
</article>`;

  return shell({
    title: `${article.title} — Veridell`,
    description: article.description || article.lead.slice(0, 155),
    path,
    body,
    jsonLd,
  });
}

/* ── indexes and the static pages ───────────────────────────────────────── */

function articleIndex() {
  const cards = articles.map((article) => `
    <a class="em-card" href="/articles/${article.slug}/">
      <strong>${esc(article.title)}</strong>
      <span>${esc(article.description || article.lead.slice(0, 120))}</span>
    </a>`).join('');

  return shell({
    title: 'Articles — Veridell',
    description: 'Thirteen complete, indexable articles: lead, key facts, numbered sections and the source behind each one.',
    path: '/articles/',
    body: `<div class="em-page em-column">
      <h1>Articles</h1>
      <p class="em-sub">Complete pages, not summaries: a lead, numbered sections, and the source behind each one.</p>
      <div class="em-grid">${cards}</div>
    </div>`,
  });
}

function topicsPage() {
  const groups = new Map();
  for (const article of articles) {
    const key = article.sections[0]?.heading?.split(' ')[0] || 'General';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }
  const blocks = [...groups.entries()].map(([key, rows]) => `
    <section class="em-section">
      <div class="em-section-head"><h2>${esc(key)}</h2><p>${rows.length} article${rows.length > 1 ? 's' : ''}</p></div>
      <div class="em-grid">${rows.map((article) => `<a class="em-card" href="/articles/${article.slug}/"><strong>${esc(article.title)}</strong><span>${esc(article.description || article.lead.slice(0, 110))}</span></a>`).join('')}</div>
    </section>`).join('');

  return shell({
    title: 'Topics — Veridell',
    description: 'Every subject the site has written about, grouped, with the article that covers it.',
    path: '/topics/',
    body: `<div class="em-page em-column"><h1>Topics</h1>
      <p class="em-sub">Every subject written here, grouped by the part of it the first section covers.</p>${blocks}</div>`,
  });
}

function questionsPage() {
  const questions = [
    ['When did Chandrayaan-3 land on the Moon?', '/articles/Chandrayaan-3/'],
    ['Who was Ashoka?', '/articles/Ashoka/'],
    ['What is photosynthesis?', '/articles/Photosynthesis/'],
    ['How does UPI move money?', '/articles/Unified_Payments_Interface/'],
    ['What is a black hole?', '/articles/Black_hole/'],
    ['What are the Vedas?', '/articles/Vedas/'],
    ['Who invented the World Wide Web?', '/articles/World_Wide_Web/'],
    ['What is Ayurveda?', '/articles/Ayurveda/'],
    ['How did India become independent?', '/articles/Indian_independence_movement/'],
    ['What does ISRO do?', '/articles/ISRO/'],
    ['Why is chess a strategy game?', '/articles/Chess/'],
    ['What is artificial intelligence?', '/articles/Artificial_intelligence/'],
  ];
  const rows = questions.map(([question, href]) => `<a class="em-card" href="${href}"><strong>${esc(question)}</strong><span>Open the article behind the answer</span></a>`).join('');

  return shell({
    title: 'Questions — Veridell',
    description: 'The questions this site is built to answer, each with the article behind it.',
    path: '/questions/',
    body: `<div class="em-page em-column"><h1>Questions</h1>
      <p class="em-sub">Each one opens the article the answer is built from. Ask any of them in your own words at <a href="/chat/">Amigo</a>.</p>
      <div class="em-grid">${rows}</div></div>`,
  });
}

function helpPage() {
  return shell({
    title: 'Help — Veridell',
    description: 'How to ask, what the badges mean, where the answers come from, and what the site stores.',
    path: '/help/',
    body: `<div class="em-page em-column">
      <h1>Help</h1>
      <p class="em-sub">Short answers to the things people ask about using the site.</p>

      <h2>How do I ask a question?</h2>
      <p>Type it the way you would say it. “Why is the sky blue” works as well as “Rayleigh scattering”. The site finds the closest article and rebuilds it around your question.</p>

      <h2>What do the badges mean?</h2>
      <ul>
        <li><strong>Source-backed</strong> — every factual sentence came from the article, and the source is listed under the answer.</li>
        <li><strong>General answer</strong> — the assistant answered from its own knowledge because no article matched. There is nothing to cite, so nothing is claimed as cited.</li>
        <li><strong>From the library</strong> — the answer is this site’s own written article, not a summary of someone else’s.</li>
      </ul>

      <h2>Does it store my questions?</h2>
      <p>Your chat history and saved answers live in this browser only. There is no account, no sign-in, and no server-side history. Saved notes are sent only when you turn memory on.</p>

      <h2>Which AI runs it?</h2>
      <p>By default the free Cloudflare Workers AI allocation. An operator can connect OpenRouter instead, and the chat can run entirely on your own machine through Ollama — in that mode nothing leaves the device.</p>

      <h2>Something is wrong with an answer</h2>
      <p>Every answer links to the article it came from. If the two disagree, the article is right — the site is a reader, not an authority.</p>
    </div>`,
  });
}

function howItWorksPage() {
  return shell({
    title: 'How it works — Veridell',
    description: 'Ask, research, filter, explain, cite: the five steps between a question and an answer with its source.',
    path: '/how-it-works/',
    body: `<div class="em-page em-column">
      <h1>How it works</h1>
      <p class="em-sub">Five steps between a question and an answer you can check.</p>

      <h2>1 · Ask</h2>
      <p>The question goes to the Wikipedia search API in the language you chose. Nothing is sent to a model yet.</p>

      <h2>2 · Research</h2>
      <p>The best-matching article is fetched in full, with its sections, and cleaned: navigation boxes, edit links, footnote markers and tables of metadata are dropped.</p>

      <h2>3 · Filter</h2>
      <p>The article is split into a lead and numbered sections, and its sentences are scored against your question. The sentences that answer it move to the top.</p>

      <h2>4 · Explain</h2>
      <p>If you are in the chat, the selected passages are handed to the model with one instruction: answer only from these, and cite them. If no article matches, the question is answered as conversation and labelled as such.</p>

      <h2>5 · Cite</h2>
      <p>Every citation points at a real passage, and every passage points at the article it came from. A marker that points at nothing is removed before the answer is shown.</p>

      <h2>What the site will not do</h2>
      <ul>
        <li>It will not invent a citation to look authoritative.</li>
        <li>It will not present a model’s memory as a sourced fact.</li>
        <li>It will not claim to replace the article it summarises.</li>
      </ul>
    </div>`,
  });
}

function researchPage() {
  return shell({
    title: 'Research desk — Veridell',
    description: 'A research-shaped view: ask, and read the answer as topics with the source sentences kept intact.',
    path: '/research/',
    body: `<div class="em-page em-column">
      <h1>Research desk</h1>
      <p class="em-sub">For a question that deserves more than a paragraph: the answer broken into topics, every sentence traceable.</p>
      <form class="em-ask" role="search" onsubmit="event.preventDefault(); location.href='/#/ask?q=' + encodeURIComponent(this.q.value)">
        <label class="em-sr" for="research-q">Research question</label>
        <input id="research-q" name="q" type="search" placeholder="e.g. What did the Chandrayaan missions actually establish?" autocomplete="off">
        <button class="em-ask-go" type="submit" aria-label="Research">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m19.5 19.5-4.3-4.3"/></svg>
        </button>
      </form>

      <h2>What the desk gives you</h2>
      <ul>
        <li>A direct answer, then the key sentences that carry it.</li>
        <li>Numbered topics, each one a section of the source article.</li>
        <li>The source, with the licence it is used under.</li>
        <li>Markdown export, so the notes can leave the browser.</li>
      </ul>

      <h2>Where it reads from</h2>
      <p>Wikipedia in twelve languages, with Wikidata for structured facts and Wikimedia Commons for images and their licences.</p>
    </div>`,
  });
}

/* ── write everything ───────────────────────────────────────────────────── */

for (const article of articles) write(`articles/${article.slug}`, articlePage(article));
write('articles', articleIndex());
write('topics', topicsPage());
write('questions', questionsPage());
write('help', helpPage());
write('how-it-works', howItWorksPage());
write('research', researchPage());

/* ── the sitemap, from the files that exist ─────────────────────────────── */

const pages = [
  { path: '/', priority: '1.0', freq: 'daily' },
  { path: '/chat/', priority: '0.9', freq: 'weekly' },
  { path: '/articles/', priority: '0.8', freq: 'weekly' },
  ...articles.map((article) => ({ path: `/articles/${article.slug}/`, priority: '0.8', freq: 'monthly' })),
  { path: '/topics/', priority: '0.7', freq: 'weekly' },
  { path: '/questions/', priority: '0.7', freq: 'weekly' },
  { path: '/research/', priority: '0.6', freq: 'monthly' },
  { path: '/how-it-works/', priority: '0.6', freq: 'monthly' },
  { path: '/help/', priority: '0.5', freq: 'monthly' },
];

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated by scripts/build-pages.mjs — do not edit by hand -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((page) => `  <url>
    <loc>${ORIGIN}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

console.log(`built ${articles.length} articles, ${pages.length} sitemap URLs`);
