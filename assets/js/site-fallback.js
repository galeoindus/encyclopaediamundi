/* Veridell — the answer Amigo gives when it cannot reach a source.
 *
 * A chat that says "something went wrong, try again" is not a chat. When the
 * model is unreachable, or the research path finds nothing to stand on, this
 * module answers from the one thing the site always has: its own library.
 *
 * The answer is deliberately shaped like the rest of Veridell — a plain
 * opening, a short honest statement of what happened, then organised sections
 * with real links the reader can open. It never pretends to be a sourced
 * answer, and it never invents a fact to fill the space.
 *
 * Matching is keyword-based and local: no request, no model, no quota. A
 * wrong-but-relevant suggestion costs a click; a made-up answer costs trust.
 */

import { SITE_PAGES } from './site-knowledge.js';

/** The published articles, as slugs and readable titles. */
const ARTICLES = [
  { slug: 'Artificial_intelligence', title: 'Artificial intelligence', keys: ['ai', 'artificial intelligence', 'machine learning', 'neural', 'chatgpt', 'llm', 'model'] },
  { slug: 'Ashoka', title: 'Ashoka', keys: ['ashoka', 'maurya', 'mauryan', 'emperor', 'kalinga', 'buddhism'] },
  { slug: 'Ayurveda', title: 'Ayurveda', keys: ['ayurveda', 'ayurvedic', 'dosha', 'herbal', 'traditional medicine'] },
  { slug: 'Black_hole', title: 'Black hole', keys: ['black hole', 'blackhole', 'event horizon', 'singularity', 'gravity', 'astrophysics'] },
  { slug: 'Chandrayaan-2', title: 'Chandrayaan-2', keys: ['chandrayaan 2', 'chandrayaan-2', 'orbiter', 'vikram lander'] },
  { slug: 'Chandrayaan-3', title: 'Chandrayaan-3', keys: ['chandrayaan 3', 'chandrayaan-3', 'moon landing', 'lunar', 'pragyan', 'chandra'] },
  { slug: 'Chess', title: 'Chess', keys: ['chess', 'opening', 'gambit', 'checkmate', 'endgame'] },
  { slug: 'ISRO', title: 'ISRO', keys: ['isro', 'space agency', 'satellite', 'pslv', 'gslv', 'indian space'] },
  { slug: 'Indian_independence_movement', title: 'Indian independence movement', keys: ['independence', 'freedom struggle', 'gandhi', 'british raj', 'quit india', 'swaraj'] },
  { slug: 'Photosynthesis', title: 'Photosynthesis', keys: ['photosynthesis', 'chlorophyll', 'plant', 'stomata', 'calvin', 'leaf'] },
  { slug: 'Unified_Payments_Interface', title: 'Unified Payments Interface', keys: ['upi', 'unified payments', 'payment', 'rupee', 'npci', 'digital payment'] },
  { slug: 'Vedas', title: 'Vedas', keys: ['veda', 'vedas', 'rigveda', 'upanishad', 'sanskrit', 'hymn'] },
  { slug: 'World_Wide_Web', title: 'World Wide Web', keys: ['world wide web', 'www', 'internet', 'http', 'browser', 'berners-lee'] },
];

/** A page's "what it is" line, keyed by path, from the site's own inventory. */
const PAGE_BY_PATH = new Map(SITE_PAGES.map((page) => [page.path, page]));

const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Words worth matching on: no stop words, no single letters. */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'what', 'who', 'why', 'how', 'when', 'where', 'which', 'that', 'this', 'these',
  'those', 'to', 'of', 'in', 'on', 'for', 'with', 'about', 'me', 'my', 'i', 'you',
  'your', 'it', 'its', 'do', 'does', 'did', 'can', 'could', 'should', 'would',
  'tell', 'explain', 'please', 'kya', 'hai', 'ka', 'ki', 'ke', 'me', 'mein',
]);

function keywords(text) {
  return norm(text)
    .split(/[^a-z0-9\u0900-\u097F]+/i)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

/**
 * Articles whose title or keywords overlap the question, best first.
 * Two points for a phrase hit, one for a word hit.
 */
export function matchArticles(question, limit = 3) {
  const text = norm(question);
  const words = new Set(keywords(question));
  const scored = [];
  for (const article of ARTICLES) {
    let score = 0;
    for (const key of article.keys) {
      if (key.includes(' ')) {
        if (text.includes(key)) score += 2;
      } else if (words.has(key)) {
        score += 1;
      }
    }
    if (score > 0) scored.push({ ...article, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Site pages relevant to the question, best first. */
export function matchPages(question, limit = 4) {
  const words = new Set(keywords(question));
  const scored = [];
  for (const page of SITE_PAGES) {
    const haystack = `${page.label} ${page.what}`.toLowerCase();
    let score = 0;
    for (const word of words) if (haystack.includes(word)) score += 1;
    if (score > 0) scored.push({ ...page, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

const link = (path, label) => `[${label}](${path})`;

/**
 * Compose the fallback answer.
 *
 * @param {string} question  what the reader asked
 * @param {object} options   { lang, reason }
 * @returns {{ markdown: string, articles: Array, pages: Array }}
 */
export function siteFallback(question, { lang = 'en', reason = 'no-source' } = {}) {
  const articles = matchArticles(question, 3);
  const pages = matchPages(question, 4);
  const hindi = String(lang).toLowerCase().startsWith('hi');

  const opened = reason === 'offline'
    ? (hindi
      ? 'मैं इस समय स्रोत तक नहीं पहुँच पा रहा हूँ, इसलिए मैं अंदाज़ा नहीं लगाऊँगा।'
      : 'I could not reach a source for that just now, so I will not guess at an answer.')
    : (hindi
      ? 'इस सवाल के लिए मुझे कोई भरोसेमंद स्रोत नहीं मिला, इसलिए मैं बना-बनाया जवाब नहीं दूँगा।'
      : 'I could not find a reliable source for that question, so I will not invent an answer.');

  const lines = [];
  lines.push(opened);
  lines.push('');

  if (articles.length) {
    lines.push(hindi ? '### इस साइट पर इस विषय पर' : '### On this site, on that subject');
    for (const article of articles) {
      lines.push(`- ${link(`/articles/${article.slug}/`, article.title)} — ${hindi ? 'पूरा लेख, संदर्भों के साथ' : 'the full article, with references'}`);
    }
    lines.push('');
  }

  lines.push(hindi ? '### जहाँ से आपको स्रोत मिलेगा' : '### Where a sourced answer comes from');
  lines.push(hindi
    ? 'वेरिडेल तीन जगह से जवाब बनाता है, और तीनों मुफ़्त हैं:'
    : 'Veridell builds answers from three places, and all three are free:');
  lines.push('');

  const steps = [
    {
      path: '/#/ask',
      label: hindi ? 'Ask' : 'Ask',
      what: hindi
        ? 'सवाल अपने शब्दों में लिखिए — यह सबसे उपयुक्त लेख चुनकर उसके मुख्य बिंदु और स्रोत दिखाता है।'
        : 'put the question in your own words — it picks the closest article and shows the key points and the sources.',
    },
    {
      path: '/#/library',
      label: hindi ? 'Library' : 'Library',
      what: hindi
        ? 'एक ही जगह से हर मुफ़्त स्रोत में खोजिए — विकिपीडिया, विकीसोर्स, क्रॉसरेफ़ और अन्य।'
        : 'search every free source at once — Wikipedia, Wikisource, Crossref, OpenAlex and more.',
    },
    {
      path: '/research/',
      label: hindi ? 'Research Desk' : 'Research Desk',
      what: hindi
        ? 'किताबें, शोध-पत्र और अभिलेख एक साथ देखिए, हर परिणाम अपने मूल स्रोत के लिंक के साथ।'
        : 'work through books, papers and archive items together, each result linked to its original.',
    },
  ];
  for (const step of steps) {
    lines.push(`- ${link(step.path, step.label)} — ${step.what}`);
  }
  lines.push('');

  const extra = pages.filter((page) => !['/#/ask', '/#/library', '/research/'].includes(page.path));
  if (extra.length) {
    lines.push(hindi ? '### शायद ये भी काम आए' : '### Also worth a look');
    for (const page of extra) {
      const known = PAGE_BY_PATH.get(page.path);
      lines.push(`- ${link(page.path, page.label)} — ${known ? known.what : page.what}`);
    }
    lines.push('');
  }

  lines.push(hindi
    ? '_यह जवाब साइट की अपनी सामग्री से बना है, किसी मॉडल से नहीं। जहाँ स्रोत नहीं था, वहाँ मैंने कह दिया।_'
    : '_This answer was built from the site’s own library, not from a model. Where there was no source, I said so._');

  return { markdown: lines.join('\n'), articles, pages };
}
