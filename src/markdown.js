/* Markdown, the small subset a model actually writes.
 *
 * The text is escaped first and only our own tags are introduced afterwards,
 * so nothing a model writes can become markup. Links are limited to http(s),
 * and a [3] citation becomes a link to the third source.
 */

import { esc } from './core.js';

function inline(text, cites) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Anything left in link shape points at a scheme we do not allow, so the
  // label is kept and the target is dropped: the reader sees words, not a
  // dead or dangerous link.
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  if (cites) {
    out = out.replace(/\[(\d{1,2})\]/g, (match, n) => (
      Number(n) <= cites
        ? `<a class="em-cite" href="#src-${n}" aria-label="Source ${n}">${n}</a>`
        : ''
    ));
  }
  return out;
}

export function markdown(source, { cites = 0 } = {}) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '), cites)}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item, cites)}</li>`).join('')}</${list.tag}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      const level = Math.min(4, Math.max(2, heading[1].length));
      out.push(`<h${level}>${inline(heading[2], cites)}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((bullet || numbered)[1]);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara(); flushList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''), cites)}</blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushPara(); flushList();
      out.push('<hr>');
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n');
}

export default markdown;
