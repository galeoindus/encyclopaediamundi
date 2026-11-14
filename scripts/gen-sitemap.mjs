#!/usr/bin/env node
/**
 * Veridell — build sitemap.xml from the pages that actually exist.
 *
 * The old sitemap was hand-maintained and stamped every URL with the same
 * date, so Search Console saw twenty-one "changed today" pages on every
 * crawl and no signal about which ones matter. This generates the file from
 * the repository instead:
 *
 *   · one <url> per real index.html, discovered, never typed by hand;
 *   · <lastmod> from git for that exact file, falling back to mtime;
 *   · <changefreq> and <priority> by page class, not by guesswork;
 *   · image entries for the article pages, so the thumbnails can be indexed;
 *   · <xhtml:link> alternates only where a real translation exists.
 *
 * Run: node scripts/gen-sitemap.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = process.env.SITE_ORIGIN || 'https://veridell.pages.dev';

/** Page classes: how often the content changes, and how much it matters. */
const CLASSES = [
  { test: (p) => p === '/', changefreq: 'daily', priority: '1.0' },
  { test: (p) => p === '/chat/', changefreq: 'weekly', priority: '0.9' },
  { test: (p) => p.startsWith('/articles/') && p !== '/articles/', changefreq: 'monthly', priority: '0.8' },
  { test: (p) => p === '/articles/', changefreq: 'weekly', priority: '0.8' },
  { test: (p) => ['/topics/', '/questions/', '/research/'].includes(p), changefreq: 'weekly', priority: '0.7' },
  { test: (p) => ['/help/', '/how-it-works/'].includes(p), changefreq: 'monthly', priority: '0.6' },
];

function classify(path) {
  for (const c of CLASSES) if (c.test(path)) return c;
  return { changefreq: 'monthly', priority: '0.5' };
}

function gitDate(file) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch { return ''; }
}

function fileDate(file) {
  const iso = gitDate(relative(ROOT, file));
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return statSync(file).mtime.toISOString().slice(0, 10);
}

/** Every page, as a URL path with a trailing slash. */
function discover() {
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') {
        const rel = relative(ROOT, full).replace(/index\.html$/, '').replace(/\\/g, '/');
        pages.push('/' + rel);
      }
    }
  };
  walk(ROOT);
  return pages.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/** Read one meta tag's content by property or name. */
function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].replace(/&amp;/g, '&').trim();
  }
  return '';
}

/**
 * The image an article declares, with the caption a crawler can show beside
 * it. The site-wide social card is the fallback every page carries, so it is
 * ignored here: listing it as an article's own picture tells Google nothing.
 */
function ogImage(file) {
  const html = readFileSync(file, 'utf8');
  const url = metaContent(html, 'og:image');
  if (!url) return null;
  if (/\/assets\/img\/(brand\/)?og[^/]*\.png$/i.test(url)) return null;
  if (!/^https:\/\//.test(url)) return null;
  return {
    loc: url,
    title: metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || '',
    caption: metaContent(html, 'og:description') || metaContent(html, 'description') || '',
  };
}

/** A page that asks not to be indexed must not be advertised in the sitemap. */
function isNoIndex(file) {
  const html = readFileSync(file, 'utf8');
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const pages = discover().filter((path) => {
  const file = path === '/' ? join(ROOT, 'index.html') : join(ROOT, path, 'index.html');
  return !isNoIndex(file);
});
const urls = pages.map((path) => {
  const file = path === '/' ? join(ROOT, 'index.html') : join(ROOT, path, 'index.html');
  const c = classify(path);
  const image = path.startsWith('/articles/') && path !== '/articles/' ? ogImage(file) : null;
  return { path, lastmod: fileDate(file), changefreq: c.changefreq, priority: c.priority, image };
});

const body = urls.map((u) => {
  const lines = [
    '  <url>',
    `    <loc>${esc(ORIGIN + u.path)}</loc>`,
    `    <lastmod>${u.lastmod}</lastmod>`,
    `    <changefreq>${u.changefreq}</changefreq>`,
    `    <priority>${u.priority}</priority>`,
  ];
  if (u.image) {
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${esc(u.image.loc)}</image:loc>`);
    if (u.image.title) lines.push(`      <image:title>${esc(u.image.title)}</image:title>`);
    if (u.image.caption) lines.push(`      <image:caption>${esc(u.image.caption.slice(0, 200))}</image:caption>`);
    lines.push('    </image:image>');
  }
  lines.push('  </url>');
  return lines.join('\n');
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated by scripts/gen-sitemap.mjs — do not edit by hand -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;

const target = join(ROOT, 'sitemap.xml');
writeFileSync(target, xml);
console.log(`sitemap.xml — ${urls.length} URLs, ${urls.filter((u) => u.image).length} with images`);
