#!/usr/bin/env node
/**
 * Veridell — build assets/data/library.json.
 *
 * Two kinds of knowledge go in:
 *
 *   1. the articles themselves, so a question about a subject the site has
 *      written up is answered from our own text rather than a model's summary
 *      of someone else's;
 *   2. the site itself — what it is, what it can do, who built it, where the
 *      data goes, and how to get help. Without this the assistant could talk
 *      about the world but not about the product it lives in, which is the
 *      first thing a new reader asks.
 *
 * Run: node scripts/gen-library.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const text = (html) => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const articles = readdirSync(join(ROOT, 'articles'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => {
    try { return statSync(join(ROOT, 'articles', slug, 'index.html')).isFile(); } catch { return false; }
  })
  .sort();

const items = [];

for (const slug of articles) {
  const html = read(`articles/${slug}/index.html`);
  const title = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || slug.replace(/_/g, ' '));
  const prose = (html.match(/<div class="prose">([\s\S]*?)<\/div>\s*(?:<div class="sources|<\/article|<\/main)/) || [])[1] || html;
  const paras = [...prose.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).filter((p) => p.length > 80);
  const lead = paras[0] || '';
  const facts = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)]
    .map((m) => ({ k: text(m[1]), v: text(m[2]).slice(0, 200) })).slice(0, 8);
  const sections = [...prose.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/g)]
    .map((m) => {
      const h = text(m[1]).replace(/^\d+\.?\s*/, '');
      const p = (m[2].match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1];
      return { h, p: p ? text(p).slice(0, 700) : '' };
    })
    .filter((s) => s.h && s.p && !/quick facts/i.test(s.h)).slice(0, 10);
  items.push({ slug, title, url: `/articles/${slug}/`, summary: lead.slice(0, 400), lead: lead.slice(0, 900), facts, sections });
}

/* ── the site itself ────────────────────────────────────────────────────────
 * Written from the pages that already exist, so the answer cannot drift from
 * the site: the reading modes and data handling come from llms.txt, the help
 * answers from the help page.
 */
const llms = read('llms.txt');
const helpHtml = read('help/index.html');
const howHtml = read('how-it-works/index.html');

const helpSections = [...helpHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/section|<\/main|$)/g)]
  .map((m) => ({ h: text(m[1]), p: text(m[2]).slice(0, 500) }))
  .filter((s) => s.h && s.p);

const howSections = [...howHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/section|<\/main|$)/g)]
  .map((m) => ({ h: text(m[1]), p: text(m[2]).slice(0, 500) }))
  .filter((s) => s.h && s.p);

items.push({
  slug: 'about-this-site',
  title: 'Veridell — about this site',
  url: '/how-it-works/',
  summary: 'Veridell turns a question into an answer taken from a published encyclopaedia entry, with the source attached. Ask in Hindi or English.',
  lead: 'Veridell turns a question into an answer taken from a published encyclopaedia entry, with the source attached. Ask in your own words in Hindi or English and get the answer, its key points, the topics the entry covers, and a link to the original page.',
  facts: [
    { k: 'What it is', v: 'An evidence-first knowledge reader: every answer carries the source it came from.' },
    { k: 'Reading modes', v: 'Article breakdown (extractive, quoted from the source) and chat (an AI answer restricted to the selected source passages, with numbered citations).' },
    { k: 'Languages', v: 'Hindi and English interface, and questions can be asked in either.' },
    { k: 'Data', v: 'No account. Bookmarks, reading history and saved answers stay in your own browser. Questions go to the same-origin API, which calls the configured model; credentials are server-side only.' },
    { k: 'Built by', v: 'Bhola Kumar (galeoindus on GitHub), as an independent project. Not part of, or endorsed by, the Wikimedia Foundation.' },
    { k: 'Built with', v: 'Plain HTML, CSS and JavaScript with no framework; Cloudflare Pages and Pages Functions for the API; Wikimedia APIs for sources; Workers AI for the free answer path.' },
    { k: 'Contributions', v: 'Article text and images come from Wikipedia and Wikimedia Commons under their licences; the interface, code and design are the project’s own.' },
    { k: 'Cost', v: 'Free to read. The default answer path runs on the free Workers AI tier; a paid model is only used if the operator has explicitly enabled it.' },
  ],
  sections: [
    { h: 'How an answer is made', p: 'Search and article requests go from your browser to the public Wikimedia APIs. When the chat is used, the question and the selected excerpts go to the same-origin /api/ask endpoint, which calls the configured model and returns an answer restricted to those excerpts, with numbered citations.' },
    { h: 'What the site can do', p: 'Ask a question and get a cited answer, browse topics, read the library of full articles, use the research desk for public-source discovery, save answers and chats on your device, and switch between Hindi and English.' },
    { h: 'Where to get help', p: 'The Help page answers the common questions: search versus ask, asking in Hindi or Hinglish, saving something, keyboard shortcuts, offline behaviour, and what to do when an answer looks wrong. There is also a feedback route and an accessibility statement.' },
    ...helpSections.slice(0, 8).map((s) => ({ h: `Help — ${s.h}`, p: s.p })),
    ...howSections.slice(0, 6).map((s) => ({ h: `How it works — ${s.h}`, p: s.p })),
  ],
});

// keep a short note of the licence position, taken from llms.txt verbatim
const licence = (llms.match(/\n## [^\n]*licen[^\n]*\n([\s\S]{0,600})/i) || [])[1];
if (licence) {
  items[items.length - 1].sections.push({ h: 'Licences', p: text(licence).slice(0, 600) });
}

const payload = { count: items.length, items };
writeFileSync(join(ROOT, 'assets/data/library.json'), JSON.stringify(payload));
console.log(`library.json — ${items.length} entries (${articles.length} articles + the site), ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB`);
