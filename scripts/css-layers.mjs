/* Which stylesheets actually reach a page, in cascade order.
 *
 * The pages no longer link ten or eleven stylesheets: the build concatenates
 * them, in the order the page asked for them, into one bundle. A test that
 * asserts "squircle.css loads before preferences.css" therefore cannot look at
 * <link> tags any more — it has to look inside the bundle.
 *
 * The bundler writes a `/* ── name.css ── *\/` marker before each sheet it
 * appends, so the original order is recoverable from the built file. When a
 * page still links its sheets individually (before a build has run), this
 * returns those instead, so the same assertion works either way.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Ordered stylesheet names a page loads, resolving a bundle to its contents. */
export function stylesheetOrder(htmlPath) {
  const html = readFileSync(resolve(ROOT, htmlPath), 'utf8');
  const hrefs = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
    .map((tag) => (tag[0].match(/href="([^"]*)"/) || [])[1] || '')
    .filter((href) => href.startsWith('/assets/css/'));

  const names = [];
  for (const href of hrefs) {
    const file = href.split('?')[0];
    if (!file.includes('/bundle-')) {
      names.push(file.split('/').pop());
      continue;
    }
    const path = join(ROOT, file.replace(/^\//, ''));
    if (!existsSync(path)) continue;
    const css = readFileSync(path, 'utf8');
    for (const m of css.matchAll(/\/\* ── ([a-z0-9-]+\.css) ── \*\//g)) names.push(m[1]);
  }
  return names;
}

/** The concatenated CSS a page actually receives, for content assertions. */
export function stylesheetSource(htmlPath) {
  const html = readFileSync(resolve(ROOT, htmlPath), 'utf8');
  const hrefs = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
    .map((tag) => (tag[0].match(/href="([^"]*)"/) || [])[1] || '')
    .filter((href) => href.startsWith('/assets/css/'));

  const parts = [];
  for (const href of hrefs) {
    const path = join(ROOT, href.split('?')[0].replace(/^\//, ''));
    if (existsSync(path)) parts.push(readFileSync(path, 'utf8'));
  }
  return parts.join('\n');
}
