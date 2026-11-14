/* Amigo — the chat page.
 *
 * Three runtimes, one composer:
 *   · Cloudflare Workers AI, through this site's own /api/ask (default, free)
 *   · OpenRouter free models, when the operator has connected a key
 *   · Ollama on the reader's own machine, called directly from the browser
 *
 * The answer never dead-ends: if Wikipedia has nothing to cite, the turn is
 * answered as conversation and labelled as such.
 */

import { h, esc, clip, read, write, initTheme, KEY, MARK } from './core.js';
import { markdown } from './markdown.js';
import { searchTitles } from './wiki.js';

const stage = document.getElementById('stage');
const scroller = document.getElementById('scroll');
const prompt = document.getElementById('prompt');
const send = document.getElementById('send');
const runtime = document.getElementById('runtime');
const depthSelect = document.getElementById('depth');
const langSelect = document.getElementById('lang');
const ollamaRow = document.getElementById('ollamaRow');
const ollamaModel = document.getElementById('ollamaModel');

const OLLAMA = 'http://127.0.0.1:11434';
let busy = false;
let turns = read(KEY.chat, []);
let attachments = [];   // { name, text } — text files the reader attached
let dictation = null;   // the live SpeechRecognition, while the mic is on
let controller = null;

const STARTERS = [
  ['What is a black hole, in simple words?', 'Explain like I am new to it'],
  ['Chandrayaan-3: what actually happened?', 'With dates and sources'],
  ['How does UPI move money?', 'The short version'],
  ['Write a short poem about the monsoon', 'Creative, no citations'],
];

/* ── state ──────────────────────────────────────────────────────────────── */

function paintRuntime() {
  const local = runtime.value === 'local';
  ollamaRow.hidden = !local;
  const saved = read(KEY.ollama, 'qwen2.5:1.5b');
  if (saved && !ollamaModel.value) ollamaModel.value = saved;
  document.getElementById('runtimeNote').textContent = local
    ? 'Prompts go straight to Ollama on this device. Nothing reaches this site.'
    : 'Prompts go to this site’s server and the free Cloudflare Workers AI allocation.';
}

function persist() {
  write(KEY.chat, turns.slice(-20));
}


/* ── the mascot ───────────────────────────────────────────────────────────
 * One little character, drawn in SVG so it costs nothing to load, with four
 * states that match what the chat is doing: resting, thinking, researching and
 * answering. It is the only thing on the page that moves while you wait, which
 * is what makes the wait feel attended to rather than ignored.
 */
const MASCOT_SVG = `
  <svg viewBox="0 0 72 72" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="emFace" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a8f74"/><stop offset="1" stop-color="#0d4a3e"/>
      </linearGradient>
      <radialGradient id="emGlow" cx=".3" cy=".25" r=".8">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="4" y="4" width="64" height="64" rx="22" fill="url(#emFace)"/>
    <rect x="4" y="4" width="64" height="64" rx="22" fill="url(#emGlow)"/>
    <g class="em-face">
      <ellipse class="em-eye" cx="27" cy="33" rx="3.4" ry="4.4" fill="#f7f3ea"/>
      <ellipse class="em-eye" cx="45" cy="33" rx="3.4" ry="4.4" fill="#f7f3ea"/>
      <path class="em-mouth" d="M30 45c4 3.4 8 3.4 12 0" fill="none" stroke="#f7f3ea" stroke-width="2.6" stroke-linecap="round"/>
    </g>
    <circle class="em-orbit" cx="36" cy="36" r="30" fill="none" stroke="#e0a06a" stroke-width="2" stroke-dasharray="6 12" opacity="0"/>
  </svg>`;

export function mascot(state = 'idle') {
  const node = h('span', { class: 'em-mascot', 'data-state': state, 'aria-hidden': 'true' });
  node.innerHTML = MASCOT_SVG;
  return node;
}

/* ── rendering ──────────────────────────────────────────────────────────── */

function emptyState() {
  return h('div', { class: 'em-chat-empty' },
    h('div', { class: 'em-chat-mascot' }, mascot('idle')),
    h('div', { class: 'em-hero-eyebrow' }, h('span', { class: 'em-dot' }), 'Veridell · AI Mode'),
    h('h1', { html: 'Ask <em>Amigo</em> anything.' }),
    h('p', { text: 'A question, a paragraph, a file — answered in plain language, with sources when the answer makes a factual claim.' }),
    h('div', { class: 'em-starters' },
      ...STARTERS.map(([question, note]) => h('button', {
        class: 'em-starter', type: 'button',
        onClick: () => submit(question),
      }, h('strong', { text: question }), h('span', { class: 'em-meta-note', text: note })))));
}

function questionTurn(text) {
  return h('div', { class: 'em-turn' }, h('div', { class: 'em-turn-q', text }));
}

function answerTurn({ text, sources = [], provider = '', plain = false, question = '', state = 'answering' }) {
  const body = h('div', { class: 'em-prose', html: markdown(text, { cites: sources.length }) });
  const wrap = h('div', { class: 'em-turn' },
    h('div', { class: 'em-turn-a' },
      h('div', { class: 'em-who' },
        mascot(state),
        h('span', { class: 'em-badge', text: plain ? 'General answer' : 'Source-backed' }),
        provider ? h('span', { class: 'em-meta-note', text: provider }) : null),
      body));

  if (sources.length) {
    const list = h('ol', { class: 'em-source-list' });
    sources.forEach((source, index) => {
      list.append(h('li', { id: `src-${index + 1}` },
        h('a', { class: 'em-source', href: source.url, target: '_blank', rel: 'noopener noreferrer' },
          h('span', { class: 'n', text: String(index + 1) }),
          h('span', { class: 't', text: source.title }))));
    });
    wrap.querySelector('.em-turn-a').append(list);
  }

  const actions = h('div', { class: 'em-actions' });
  const copy = h('button', { type: 'button', text: 'Copy' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; } catch { copy.textContent = 'Blocked'; }
  });
  const again = h('button', { type: 'button', text: 'Ask again' });
  again.addEventListener('click', () => question && submit(question));
  actions.append(copy, again);
  wrap.querySelector('.em-turn-a').append(actions);

  const follow = h('div', { class: 'em-follow' });
  for (const idea of ['Explain that more simply', 'Give me an example', 'Go deeper']) {
    follow.append(h('button', { type: 'button', text: idea, onClick: () => submit(idea) }));
  }
  wrap.querySelector('.em-turn-a').append(follow);
  return wrap;
}

function paintThread() {
  if (!turns.length) {
    stage.replaceChildren(emptyState());
    return;
  }
  const frag = document.createDocumentFragment();
  for (const turn of turns) {
    frag.append(questionTurn(turn.question));
    frag.append(answerTurn(turn));
  }
  stage.replaceChildren(frag);
  scrollDown();
}

function scrollDown() {
  requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
}

function liveParagraph(node) {
  node.replaceChildren(h('div', { class: 'em-turn-a' }, h('div', { class: 'em-prose' })));
  const prose = node.querySelector('.em-prose');
  let text = '';
  return {
    update(chunk, kind) {
      text = kind === 'replace' ? String(chunk) : text + String(chunk);
      prose.innerHTML = markdown(text, { cites: 0 });
      scrollDown();
    },
    get value() { return text; },
  };
}

function thinking(state = 'thinking', label = 'Reading sources…') {
  const node = h('div', { class: 'em-turn em-turn--working' },
    h('p', { class: 'em-thinking' }, mascot(state), h('span', { text: label })));
  stage.append(node);
  scrollDown();
  return node;
}

/* ── the request ────────────────────────────────────────────────────────── */

function historyForModel() {
  return turns.slice(-6).flatMap((turn) => ([
    { role: 'user', content: turn.question },
    { role: 'assistant', content: turn.text },
  ]));
}

async function askLocalOllama(question) {
  const model = (ollamaModel.value || 'qwen2.5:1.5b').trim();
  write(KEY.ollama, model);
  const response = await fetch(`${OLLAMA}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are Amigo, a clear and friendly assistant. Answer the question directly, in the language it was asked in. Use short paragraphs. Never invent citations.' },
        ...historyForModel(),
        { role: 'user', content: question },
      ],
      stream: false,
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!response.ok) throw new Error(`Ollama answered HTTP ${response.status}. Is it running, and is this site in OLLAMA_ORIGINS?`);
  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('The local model returned an empty answer.');
  return { text, provider: `Ollama · ${model}`, sources: [], plain: true };
}

async function askCloud(question, passages, onDelta) {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      question,
      mode: passages.length ? 'grounded' : 'chat',
      depth: depthSelect.value,
      history: historyForModel(),
      passages,
      attachments: attachments.map((file) => ({ name: file.name, text: file.text })),
      stream: typeof onDelta === 'function',
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'The assistant is unavailable right now. Try again in a moment.');
  }

  /* Server-sent events: the words are painted as they arrive, which is the
   * difference between a chat and a spinner. */
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let final = null;

    const consume = (frame) => {
      const payload = frame.split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!payload) return;
      let event;
      try { event = JSON.parse(payload); } catch { return; }
      if (event.type === 'delta' && event.text) {
        accumulated += event.text;
        onDelta?.(event.text, 'append');
      } else if (event.type === 'replace') {
        accumulated = String(event.text || '');
        onDelta?.(accumulated, 'replace');
      } else if (event.type === 'done') {
        final = event;
      } else if (event.type === 'error') {
        throw new Error(event.message || 'The assistant could not finish this answer.');
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) consume(frame);
    }
    if (buffer.trim()) consume(buffer);

    const text = final?.answer || accumulated;
    if (!text) throw new Error('The answer came back empty. Please try again.');
    return {
      text,
      provider: final?.model ? `${final.provider} · ${final.model}` : 'Amigo',
      sources: (final?.sources || []).map((source) => ({ title: source.title, url: source.url })),
      plain: !(final?.sources || []).length,
    };
  }

  const data = await response.json().catch(() => null);
  if (!data?.answer) {
    throw new Error(data?.message || 'The assistant is unavailable right now. Try again in a moment.');
  }
  onDelta?.(data.answer, 'replace');
  return {
    text: data.answer,
    provider: data.model ? `${data.provider} · ${data.model}` : data.provider || 'Amigo',
    sources: (data.sources || []).map((source) => ({ title: source.title, url: source.url })),
    plain: !(data.sources || []).length,
  };
}

async function submit(raw) {
  const question = String(raw ?? '').trim();
  if (!question || busy) return;
  busy = true;
  send.setAttribute('aria-label', 'Stop');
  send.classList.add('is-stop');
  prompt.value = '';
  prompt.style.height = 'auto';
  stage.querySelector('.em-chat-empty')?.remove();

  stage.append(questionTurn(question));
  const deep = (depthSelect.value || 'detailed') === 'deep';
  const wait = thinking(deep ? 'researching' : 'thinking', deep ? 'Researching the sources…' : 'Reading sources…');
  controller = new AbortController();

  try {
    let reply;
    if (runtime.value === 'local') {
      reply = await askLocalOllama(question);
    } else {
      let passages = [];
      try {
        const hits = await searchTitles(question, langSelect.value, 3, controller.signal);
        if (hits.length) {
          const url = `https://${langSelect.value}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&exintro=0&redirects=1&titles=${encodeURIComponent(hits[0].title)}`;
          const res = await fetch(url, { signal: controller.signal });
          const data = await res.json().catch(() => null);
          const page = Object.values(data?.query?.pages || {})[0];
          const text = String(page?.extract || '').slice(0, 9000);
          if (text) {
            passages = [{
              title: hits[0].title,
              text,
              url: `https://${langSelect.value}.wikipedia.org/wiki/${encodeURIComponent(hits[0].title.replace(/ /g, '_'))}`,
              sourceType: 'Wikipedia',
            }];
          }
        }
      } catch { /* no sources is a valid state: answer as conversation */ }
      const live = liveParagraph(wait);
      reply = await askCloud(question, passages, (chunk, kind) => live.update(chunk, kind));
    }

    wait.remove();
    const turn = { question, ...reply };
    turns.push(turn);
    attachments = [];
    paintTray();
    persist();
    stage.append(answerTurn(turn));
    scrollDown();
  } catch (error) {
    wait.remove();
    if (error?.name === 'AbortError') {
      stage.append(answerTurn({ text: 'Stopped.', plain: true, provider: '' }));
    } else {
      stage.append(answerTurn({
        text: `${error.message}\n\nYou can switch the runtime below, or try again.`,
        plain: true,
        provider: 'Could not answer',
        question,
      }));
    }
  } finally {
    controller = null;
    busy = false;
    send.setAttribute('aria-label', 'Send');
    send.classList.remove('is-stop');
    prompt.focus();
  }
}

/* ── wiring ─────────────────────────────────────────────────────────────── */

/* ── dictation ────────────────────────────────────────────────────────────
 * The browser's own speech recognition writes into the composer as you talk.
 * No audio is uploaded anywhere by this code: the recognition runs in the
 * browser, and only the finished text ever reaches the site.
 */
function setupDictation() {
  const mic = document.getElementById('micBtn');
  if (!mic) return;
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) { mic.hidden = true; return; }  // no support: no dead button
  mic.hidden = false;

  const stop = () => {
    mic.classList.remove('is-listening');
    mic.setAttribute('aria-pressed', 'false');
    try { dictation?.stop(); } catch { /* already stopped */ }
    dictation = null;
  };

  mic.addEventListener('click', () => {
    if (dictation) { stop(); return; }

    const recognition = new Speech();
    recognition.lang = langSelect.value === 'hi' ? 'hi-IN' : langSelect.value === 'en' ? 'en-IN' : langSelect.value;
    recognition.interimResults = true;
    recognition.continuous = false;
    dictation = recognition;

    const typedBefore = prompt.value;
    mic.classList.add('is-listening');
    mic.setAttribute('aria-pressed', 'true');

    recognition.onresult = (event) => {
      let text = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        text += event.results[index][0].transcript;
      }
      prompt.value = `${typedBefore}${typedBefore && !typedBefore.endsWith(' ') ? ' ' : ''}${text}`.slice(0, 2000);
      autoGrow();
    };
    recognition.onerror = () => stop();
    recognition.onend = () => stop();
    try { recognition.start(); } catch { stop(); }
  });
}

/* ── attachments ──────────────────────────────────────────────────────────
 * A text file the reader attaches is read here, in the browser, and sent as
 * context with the question. Nothing is uploaded on its own, and a binary file
 * is refused rather than half-read.
 */
const MAX_FILE_CHARS = 12000;
const MAX_FILES = 3;

function paintTray() {
  const tray = document.getElementById('attachmentTray');
  if (!tray) return;
  tray.replaceChildren();
  tray.hidden = attachments.length === 0;
  attachments.forEach((file, index) => {
    const chip = h('span', { class: 'em-tray-chip' },
      h('span', { class: 'em-tray-name', text: file.name }),
      h('button', {
        type: 'button', class: 'em-tray-x', 'aria-label': `Remove ${file.name}`,
        onClick: () => { attachments.splice(index, 1); paintTray(); },
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
      }));
    tray.append(chip);
  });
}

function setupAttachments() {
  const button = document.getElementById('attachBtn');
  const input = document.getElementById('fileInput');
  if (!button || !input) return;

  button.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])].slice(0, MAX_FILES - attachments.length);
    for (const file of files) {
      if (file.size > 400_000) continue;               // a text file that big is a data dump
      if (!/\.(txt|md|markdown|csv|tsv|json|xml|html?|log|ya?ml)$/i.test(file.name) && !file.type.startsWith('text/')) continue;
      const text = await file.text().catch(() => '');
      if (!text.trim()) continue;
      attachments.push({ name: file.name, text: text.slice(0, MAX_FILE_CHARS) });
    }
    input.value = '';
    paintTray();
  });
}



function autoGrow() {
  prompt.style.height = 'auto';
  prompt.style.height = `${Math.min(prompt.scrollHeight, window.innerHeight * 0.4)}px`;
}

prompt.addEventListener('input', autoGrow);
prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit(prompt.value);
  }
});

/* The composer is a form, so a click on Send submits it. Without this the
 * browser navigates and the page reloads — which is exactly what "the chat does
 * not work" looks like: you type, you press send, the page blinks and the
 * question is gone. */
document.getElementById('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  submit(prompt.value);
});

/* Send becomes Stop while a request is in flight: the same button, the same
 * place, no second control to find. */
send.addEventListener('click', (event) => {
  if (busy && controller) {
    event.preventDefault();
    controller.abort();
    return;
  }
  event.preventDefault();
  submit(prompt.value);
});
runtime.addEventListener('change', () => { write(KEY.runtime, runtime.value); paintRuntime(); });
document.getElementById('clearChat').addEventListener('click', () => {
  turns = [];
  persist();
  paintThread();
});

setupDictation();
setupAttachments();
paintTray();

runtime.value = read(KEY.runtime, 'cloud');
depthSelect.value = read(KEY.depth, 'detailed');
langSelect.value = read(KEY.lang, 'en');
depthSelect.addEventListener('change', () => write(KEY.depth, depthSelect.value));
langSelect.addEventListener('change', () => write(KEY.lang, langSelect.value));

initTheme();
paintRuntime();
paintThread();

const initial = new URLSearchParams(location.search).get('q');
if (initial) submit(initial);
