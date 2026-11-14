/* Veridell — what the site knows about itself.
 *
 * The chat is asked about the site constantly: what it is, where a page lives,
 * whether it stores anything, which model answered, why a source is cited. A
 * model should not be paid to guess at any of that, and a guess is exactly the
 * kind of answer that damages trust. So the facts live here, once, and the chat
 * answers them from this file — instantly, offline, and identically every time.
 *
 * The same facts are injected into the AI prompt as context, so a model that
 * does get asked about Veridell answers from the product's own description
 * rather than from imagination.
 *
 * Everything in this file is a claim the repository can back: routes that
 * exist, sources that are actually called, limits that are enforced in code.
 */

import { SITE } from './config.js';

export const SITE_PAGES = [
  { path: '/', label: 'Home', what: 'The front door: ask a question, browse topics, and see the article of the day.' },
  { path: '/#/ask', label: 'Ask', what: 'A question in your own words, answered from the best-matching article with its key points and sources.' },
  { path: '/#/search', label: 'Search', what: 'Matching articles as cards when you want to choose the topic yourself.' },
  { path: '/#/article/Black_hole', label: 'Article', what: 'A breakdown, not a Wikipedia page: the direct answer, key points, numbered topics, facts, sources and method.' },
  { path: '/#/today', label: 'On this day', what: 'Events, births, deaths and holidays for any date, as a timeline.' },
  { path: '/#/explore', label: 'Explore', what: 'Categories and the most-read articles right now.' },
  { path: '/#/library', label: 'Library', what: 'One search across every free, keyless source Veridell knows, grouped by source.' },
  { path: '/#/sources', label: 'Sources', what: 'Every source the site reads, what it is, and the licence it is used under.' },
  { path: '/#/bookmarks', label: 'Saved', what: 'Articles and answers you kept, stored on this device only.' },
  { path: '/#/history', label: 'History', what: 'What you read, on this device only, clearable at any time.' },
  { path: '/#/credits', label: 'Credits', what: 'The project identity, the maker, the knowledge and infrastructure it runs on, and the licences.' },
  { path: '/articles/', label: 'Articles', what: 'Thirteen complete, indexable article pages with citations and references.' },
  { path: '/topics/', label: 'Topics', what: 'The published article collection, by subject.' },
  { path: '/questions/', label: 'Questions', what: 'Common questions, each answered on its own page.' },
  { path: '/research/', label: 'Research Desk', what: 'A workbench for open sources, papers and archive items.' },
  { path: '/how-it-works/', label: 'How it works', what: 'The pipeline in plain words: ask, research, filter, explain, cite.' },
  { path: '/help/', label: 'Help', what: 'How to use the site, and what each control does.' },
  { path: '/chat/', label: 'Amigo chat', what: 'This page: AI Mode, with Chat and Research modes and cited answers.' },
];

export const SITE_FACTS = {
  what: 'Veridell is a public knowledge research and discovery site. You ask a question or open a topic and get a direct answer, the key points, a topic-wise breakdown, the facts from the infobox, and the sources behind every claim.',
  free: 'It is free and needs no account, no email and no phone number. There is no sign-in and no personal profile.',
  sources: 'Factual answers are built from Wikipedia article text, with Wikidata for facts and Wikimedia Commons for media. The Library and the Research Desk also read Crossref, OpenAlex, Europe PMC, DOAJ, Open Library, Project Gutenberg and the Internet Archive.',
  citations: 'Every research answer marks the passages it used with numbered citations. Each citation opens the exact source, so a claim can be checked instead of trusted.',
  privacy: 'Chat history, bookmarks and saved memory stay in this browser on this device. Nothing syncs across devices. Memory is used only when you switch it on, and you can export or clear it. Attached files are read in the browser, are not kept in saved history, and are limited to 4 MB each.',
  ai: 'The assistant runs on free models only. A deployment answers through Cloudflare Workers AI or through OpenRouter\u2019s free models \u2014 both cost nothing per answer \u2014 and the operator picks which. Paid models are switched off unless the operator deliberately turns them on. A local Ollama model can also be connected on your own device, in which case nothing leaves it. If no provider is reachable, the page shows the source excerpt instead of pretending an AI answered.',
  routing: 'Auto reads the question first. Ordinary conversation, writing and creative requests go to the lightest model; factual and research questions go to the source-grounded path, which searches Wikipedia first and only then asks a model to explain those passages.',
  depth: 'Answer depth has three levels: Quick, Detailed and Deep. Quick answers briefly, Detailed explains in topics, and Deep opens every topic block extended.',
  languages: 'The interface is in English and हिन्दी. Content can be read in twelve languages: English, हिन्दी, বাংলা, தமிழ், తెలుగు, मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ, اردو and संस्कृतम्.',
  limits: 'A question is limited to 800 characters, attachments to 4 MB per file, and a chat keeps the last eight turns as context.',
  library: 'The Library searches every free source the site knows in one place. It is the fastest way to see whether Veridell has anything on a subject before asking.',
  reliability: 'Answers are extractive by default: the sentences come from the article and the ranking only chooses the order. Chat answers are labelled as conversation and are never dressed up as sourced fact.',
};

/**
 * What counts as "you are being asked about Veridell itself".
 *
 * Two tiers, because one flat list of words answered the wrong question. A
 * message saying "privacy" or "amigo" used to be captured and answered with
 * product facts — so "What is privacy engineering?" got a paragraph about this
 * site's storage, and "Tell me about Amigo the film" was misrouted.
 *
 *   · STRONG  — a reference that can only mean this product. Enough on its own.
 *   · WEAK    — a word that is about the product *only* next to one of those.
 *
 * A weak hit with no product context falls through to ordinary routing, which
 * is the safe direction: a real product question still names the product.
 */
const SITE_STRONG = new RegExp([
  'veridell', 'वेरिडेल', 'veri dell',
  'this (?:site|website|web ?site|app|platform|page)',
  'the (?:site|website|platform)',
  'your (?:site|website|app|platform|project)',
  'इस (?:साइट|वेबसाइट|ऐप|पेज)', 'आपकी (?:साइट|वेबसाइट)', 'साइट के बारे में',
  'who made (?:this|it|you)', 'who built (?:this|it|you)', 'who owns (?:this|it)',
  'how (?:do|does) (?:this|it) work', 'what can (?:i|you) do (?:here|on this site)',
  'is (?:this|it) free', 'do you (?:store|save|keep|track) (?:my )?',
  'where (?:are|is) (?:the )?sources', 'how many sources',
  'कौन बनाता', 'किसने बनाया', 'फ्री है', 'स्रोत कहाँ',
].join('|'), 'iu');

/** Words that mean the product only when something above is in the message. */
const SITE_WEAK = /amigo|credits|privacy|which model|what model|इंद्रधनुष|मॉडल/iu;

/** Something in the message that points at this product. */
const SITE_CONTEXT_SIGNAL = new RegExp([
  'veridell', 'वेरिडेल',
  'this (?:site|website|web ?site|app|platform|page)',
  'your (?:site|website|app|platform|project)',
  'इस (?:साइट|वेबसाइट|ऐप|पेज)', 'आपकी (?:साइट|वेबसाइट)',
  'do you', 'are you', 'you use', 'you run', 'यहाँ',
].join('|'), 'iu');

/** Does this message ask about the product rather than the world? */
export function isSiteQuestion(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 400) return false;
  if (SITE_STRONG.test(text)) return true;
  return SITE_WEAK.test(text) && SITE_CONTEXT_SIGNAL.test(text);
}

const PAGE_LINE = (page) => `- **[${page.label}](${page.path})** — ${page.what}`;

/** A complete, link-bearing answer about the site, in the reader's language. */
export function siteAnswerMarkdown(question, lang = 'en') {
  const q = String(question ?? '').toLowerCase();
  const hindi = lang === 'hi';
  const out = [];

  const asksAbout = (...needles) => needles.some((n) => q.includes(n));
  const wantsPages = asksAbout('page', 'route', 'navigate', 'navigation', 'where is', 'where can', 'कहाँ', 'पेज', 'कहां');
  const wantsPrivacy = asksAbout('privacy', 'store', 'save', 'data', 'track', 'history', 'private', 'गोपनीय', 'डेटा', 'स्टोर');
  const wantsSources = asksAbout('source', 'cite', 'citation', 'reference', 'wikipedia', 'स्रोत', 'हवाला');
  const wantsModels = asksAbout('model', 'ai', 'workers', 'ollama', 'openrouter', 'provider', 'मॉडल');
  const wantsCost = asksAbout('free', 'price', 'cost', 'pay', 'कीमत', 'फ्री', 'पैसा');

  if (hindi) {
    out.push(`**Veridell** एक मुफ़्त, सार्वजनिक ज्ञान-खोज साइट है। आप सवाल पूछते हैं या कोई विषय खोलते हैं और सीधा जवाब, मुख्य बिंदु, विषय-वार विवरण, तथ्य और हर दावे के पीछे का स्रोत मिलता है।`);
  } else {
    out.push(`**Veridell** is a free, public knowledge research and discovery site. You ask a question or open a topic and get a direct answer, the key points, a topic-wise breakdown, the facts from the infobox, and the source behind every claim.`);
  }

  out.push('');
  out.push(hindi ? '## मुख्य बातें' : '## The essentials');
  out.push(`- ${hindi ? 'बिना अकाउंट, बिना ईमेल, बिना फ़ोन नंबर। कोई साइन-इन नहीं।' : SITE_FACTS.free}`);
  out.push(`- ${hindi ? 'तथ्य विकिपीडिया के लेखों से, आँकड़े विकिडेटा से, चित्र विकिमीडिया कॉमन्स से।' : SITE_FACTS.sources}`);
  out.push(`- ${hindi ? 'हर शोध-जवाब अपने स्रोतों को क्रमांकित हवालों के रूप में दिखाता है, जिन्हें खोलकर दावा जाँचा जा सकता है।' : SITE_FACTS.citations}`);
  // "Your data" below repeats the privacy sentence word for word, so the
  // essentials list leaves it to that section.
  if (!/privacy|store|data|history|गोपनीय|डेटा/.test(q)) out.push(`- ${hindi ? 'चैट इतिहास, बुकमार्क और मेमोरी इसी ब्राउज़र में इस डिवाइस पर रहते हैं।' : 'Chat history, bookmarks and memory stay in this browser on this device.'}`);

  if (wantsSources || !wantsModels) {
    out.push('');
    out.push(hindi ? '## स्रोत कैसे काम करते हैं' : '## How the sources work');
    out.push(hindi
      ? 'सवाल पहले विकिपीडिया पर खोजा जाता है, सबसे मिलता लेख पूरा पढ़ा जाता है, उसमें से आपके सवाल से जुड़े वाक्य चुने जाते हैं, और फिर मॉडल सिर्फ़ उन्हीं अंशों को समझाकर जवाब लिखता है। हर तथ्य के आगे [n] हवाला रहता है।'
      : 'The question is searched on Wikipedia first, the best-matching article is read in full, the sentences that answer the question are scored and selected, and only then does a model explain those passages. Every factual sentence carries a numbered citation that opens the exact source.');
  }

  if (wantsPrivacy) {
    out.push('');
    out.push(hindi ? '## आपका डेटा' : '## Your data');
    out.push(`- ${hindi ? 'चैट इतिहास, बुकमार्क और मेमोरी इसी ब्राउज़र में इस डिवाइस पर रहते हैं; किसी दूसरे डिवाइस पर नहीं जाते।' : SITE_FACTS.privacy}`);
    out.push(hindi ? '- मेमोरी तभी इस्तेमाल होती है जब आप उसे चालू करते हैं; उसे कभी भी एक्सपोर्ट या मिटाया जा सकता है।' : '- Memory is used only when you turn it on, and you can export or clear it at any time.');
  }

  if (wantsModels) {
    out.push('');
    out.push(hindi ? '## कौन-सा AI जवाब देता है' : '## Which AI answers');
    out.push(`- ${hindi ? 'डिफ़ॉल्ट: Cloudflare Workers AI (मुफ़्त)। वैकल्पिक: OpenRouter का भुगतान पूल, और आपके डिवाइस पर Ollama।' : SITE_FACTS.ai}`);
    out.push(`- ${hindi ? 'ऑटो मोड सवाल पढ़कर हल्की बातचीत के लिए सबसे हल्का मॉडल और तथ्यात्मक सवालों के लिए स्रोत-आधारित रास्ता चुनता है।' : SITE_FACTS.routing}`);
  }

  if (wantsCost) {
    out.push('');
    out.push(hindi ? '## कीमत' : '## Cost');
    out.push(hindi ? 'साइट इस्तेमाल करने के लिए कुछ भी नहीं देना है। मुफ़्त Workers AI कोटा खत्म होने पर जवाब साफ़ बताता है, चुपचाप भुगतान वाले मॉडल पर नहीं जाता।' : 'Using the site costs nothing. When the free Workers AI quota is exhausted the page says so plainly instead of silently moving you onto a paid model.');
  }

  // The full index when the question is about navigation, and a compact
  // doorway otherwise: a site answer should always leave the reader somewhere
  // useful to go, not only when they thought to ask for a list.
  out.push('');
  out.push(hindi ? '## पेज' : '## Where things live');
  if (wantsPages) {
    for (const page of SITE_PAGES) out.push(PAGE_LINE(page));
  } else {
    const key = ['/#/ask', '/articles/', '/#/library', '/#/sources', '/how-it-works/'];
    for (const page of SITE_PAGES.filter((entry) => key.includes(entry.path))) out.push(PAGE_LINE(page));
  }

  out.push('');
  out.push(hindi ? '## किस पर भरोसा करें' : '## What to trust');
  out.push(hindi
    ? 'जवाब के कार्ड पर लिखा रहता है कि वह स्रोत-आधारित है या बातचीत, और नीचे हर स्रोत खुलने योग्य होता है। जहाँ स्रोत किसी दावे को नहीं ढकते, वहाँ पेज ऐसा कहता है।'
    : 'Every answer is labelled: **Source-backed** when it was built from cited passages, **Conversation** when it is the model talking. The sources sit under the answer and open the exact page. Where the passages do not cover a claim, the page says so rather than filling the gap.');

  return out.join('\n');
}

/** Prompt context: short, factual, and the same for every provider. */
export const SITE_CONTEXT = [
  'VERIDELL PRODUCT FACTS (authoritative; do not invent beyond these):',
  `- ${SITE_FACTS.what}`,
  `- ${SITE_FACTS.free}`,
  `- ${SITE_FACTS.sources}`,
  `- ${SITE_FACTS.citations}`,
  `- ${SITE_FACTS.ai}`,
  `- ${SITE_FACTS.routing}`,
  `- ${SITE_FACTS.privacy}`,
  `- ${SITE_FACTS.languages}`,
  `- ${SITE_FACTS.limits}`,
  `- Pages: ${SITE_PAGES.map((p) => `${p.label} ${p.path}`).join('; ')}.`,
  `- Site version: ${SITE.version}.`,
].join('\n');
