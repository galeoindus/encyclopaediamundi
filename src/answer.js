/* Turning an article into an answer.
 *
 * Wikipedia gives one long document. A reader asked a question, so the page is
 * rebuilt around that: a lead, the sentences that answer it, numbered topics,
 * and a source list. Nothing is invented — every sentence here is a sentence
 * from the article, only chosen and ordered.
 */

import { clip } from './core.js';

const DROP = [
  '.mw-editsection', '.reference', '.reflist', '.navbox', '.vertical-navbox',
  '.infobox', '.sidebar', '.hatnote', '.metadata', '.ambox', '.mbox-text',
  '.thumb', 'figure', 'table', 'style', 'script', 'sup.reference', '.mw-empty-elt',
  '.shortdescription', '.mw-jump-link', '.printfooter', '.catlinks', '#toc', '.toc',
];

const BLOCK = new Set(['P', 'UL', 'OL', 'DL', 'BLOCKQUOTE', 'DIV']);

/** Strip the furniture out of a parsed article and keep readable blocks. */
export function cleanArticle(html) {
  const doc = new DOMParser().parseFromString(`<div id="em-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('em-root');
  for (const selector of DROP) {
    for (const node of root.querySelectorAll(selector)) node.remove();
  }
  for (const node of root.querySelectorAll('a')) {
    const text = doc.createTextNode(node.textContent || '');
    node.replaceWith(text);
  }
  return root;
}

/** Split the cleaned article into a lead and numbered sections. */
export function outline(root) {
  const blocks = [];
  let current = { heading: '', paragraphs: [] };

  const pushText = (text) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length > 40) current.paragraphs.push(value);
  };

  /* The parsed article wraps everything in `.mw-parser-output`, so walking
   * only the top-level children of the container finds one <div> and nothing
   * else — which is how an article page ended up with a title and no text.
   * Select the blocks in document order instead, whatever they are nested in. */
  const nodes = root.querySelectorAll('h2, h3, p, ul, ol, blockquote');

  for (const node of nodes) {
    const tag = node.tagName;
    if (node.closest('li, blockquote') && tag !== 'BLOCKQUOTE') continue;
    if (tag === 'H2' || tag === 'H3') {
      if (current.paragraphs.length || current.heading) blocks.push(current);
      current = { heading: String(node.textContent || '').replace(/\[\d+\]/g, '').trim(), paragraphs: [] };
    } else if (tag === 'P') {
      pushText(node.textContent);
    } else if (BLOCK.has(tag) && !current.paragraphs.length) {
      // A list straight after a heading still belongs to that topic.
      for (const item of node.querySelectorAll('li')) pushText(item.textContent);
    }
  }
  if (current.paragraphs.length || current.heading) blocks.push(current);

  const lead = [];
  const topics = [];
  for (const block of blocks) {
    if (!block.heading && !topics.length) lead.push(...block.paragraphs);
    else if (block.heading && block.paragraphs.length) topics.push(block);
  }
  return { lead, topics };
}

const STOP = new Set(('a an the of and or in on at to for from by with about as is are was were be been being '
  + 'what who whom whose when where why how which that this these those it its do does did can could should would '
  + 'tell me about please explain give list does do').split(' '));

const words = (text) => String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

function score(sentence, terms) {
  if (!terms.length) return 0;
  const bag = new Set(words(sentence));
  let hit = 0;
  for (const term of terms) if (bag.has(term)) hit += 1;
  return hit / terms.length;
}

/** The sentences from the lead that answer the question, best first. */
export function keySentences(lead, question, count = 3) {
  const terms = [...new Set(words(question))].filter((word) => word.length > 2 && !STOP.has(word));
  const pool = [];
  for (const paragraph of lead) {
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      const text = sentence.trim();
      if (text.length > 24) pool.push(text);
    }
  }
  if (!pool.length) return [];
  if (!terms.length) return pool.slice(0, count);
  return pool
    .map((sentence, index) => ({ sentence, index, score: score(sentence, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .filter((row) => row.score > 0)
    .map((row) => row.sentence);
}

/** Topics ordered by how much they overlap the question. */
export function rankTopics(topics, question) {
  const terms = [...new Set(words(question))].filter((word) => word.length > 2 && !STOP.has(word));
  return topics
    .map((topic, index) => ({
      topic,
      index,
      score: score(`${topic.heading} ${topic.paragraphs.join(' ')}`, terms),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.topic);
}

/**
 * The whole answer, at the depth the reader picked.
 *   quick    — the lead and two topics
 *   detailed — three key sentences and four topics
 *   deep     — every topic the article has, with more of each
 */
export function composeAnswer({ title, html, question = '', depth = 'detailed', url = '' }) {
  const root = cleanArticle(html);
  const { lead, topics } = outline(root);

  const sizes = {
    quick: { sentences: 2, topics: 2, paragraphs: 2 },
    detailed: { sentences: 3, topics: 4, paragraphs: 2 },
    deep: { sentences: 4, topics: 12, paragraphs: 4 },
  }[depth] || { sentences: 3, topics: 4, paragraphs: 2 };

  const points = keySentences(lead, question, sizes.sentences);
  const ordered = rankTopics(topics, question).slice(0, sizes.topics);

  return {
    title,
    url,
    lead: clip(lead[0] || '', 700),
    points,
    topics: ordered.map((topic) => ({
      heading: topic.heading,
      paragraphs: topic.paragraphs.slice(0, sizes.paragraphs).map((text) => clip(text, 900)),
    })),
  };
}

/** The same article, as plain text, for the model and for Markdown export. */
export function answerText(answer) {
  return [
    `# ${answer.title}`,
    answer.lead,
    answer.points.length ? answer.points.map((point) => `- ${point}`).join('\n') : '',
    ...answer.topics.map((topic) => `## ${topic.heading}\n${topic.paragraphs.join('\n\n')}`),
    answer.url ? `Source: ${answer.url}` : '',
  ].filter(Boolean).join('\n\n');
}
