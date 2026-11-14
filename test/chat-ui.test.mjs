import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { stylesheetOrder } from '../scripts/css-layers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(ROOT, path), 'utf8');

const [html, js, conversationJs, liveResearchJs, css, amigoCss, logo, articleJs, uiCss, experienceCss] = await Promise.all([
  read('chat/index.html'),
  read('assets/js/chat-page.js'),
  read('assets/js/conversation.js'),
  read('assets/js/live-research.js'),
  read('assets/css/chat-redesign.css'),
  read('assets/css/amigo-chat.css'),
  read('assets/js/mascot.js'),
  read('assets/js/views/article.js'),
  read('assets/css/amigo-ui.css'),
  read('assets/css/chat-experience.css'),
]);

test('the chat page carries exactly one Amigo, in the welcome state', () => {
  // The artwork is used exactly as delivered, so the states are pictures cut
  // from the character sheet rather than a redrawing. Exactly one instance is
  // on the page: the rail used to draw a second copy of the same face beside
  // the hero, so the empty chat opened with Amigo twice. The rail's mark is
  // the site facet now.
  assert.equal((html.match(/class="amigo amigo--/g) || []).length, 1);
  assert.match(html, /id="welcomeAmigo"/);
  assert.doesNotMatch(html, /id="railAmigo"/);
  assert.match(html, /assets\/img\/amigo\/front\.png/);
  assert.match(html, /assets\/img\/brand\/facet\.svg/);
  assert.match(html, /<em>AI Mode<\/em>/);
  // every pose the interface can show exists in the module
  for (const state of ['idle', 'thinking', 'happy', 'listening', 'sleepy']) {
    assert.match(logo, new RegExp(`${state}: \\{ file:`), state);
  }
});

test('the composer remains inside the main scroll surface for empty and active chats', () => {
  assert.match(html, /<div class="scroll" id="main"[\s\S]*<div class="stage">[\s\S]*<div class="dock" id="dock">/);
  assert.match(html, /id="prompt"/);
  assert.match(html, /id="send"/);
});

test('research questions use the free live-source adapter for Wikipedia and academic records', () => {
  assert.match(js, /searchLiveSources\(query, language, limit, signal\)/);
  assert.match(liveResearchJs, /generator:\s*'search'/);
  assert.match(liveResearchJs, /prop:\s*'extracts\|info\|pageimages\|description'/);
  assert.match(liveResearchJs, /pithumbsize:\s*'480'/);
  assert.match(liveResearchJs, /api\.crossref\.org/);
  assert.match(liveResearchJs, /api\.openalex\.org/);
});

test('Wikipedia results render readable article cards with safe links and image fallback', () => {
  assert.match(js, /function renderArticleResults\(passages\)/);
  assert.match(js, /el\('a', 'src-card'\)/);
  assert.match(js, /src-excerpt/);
  assert.match(js, /wikiUrl\(source\.url\)/);
  assert.match(js, /media\.classList\.add\('is-placeholder'\)/);
});

test('small talk follows a conversation path and stays usable if the model endpoint is unavailable', () => {
  assert.match(js, /import \{[^}]*isSmallTalk[^}]*\} from '\.\/conversation\.js'/);
  assert.match(conversationJs, /export function isSmallTalk\(value\)/);
  assert.match(js, /mode:\s*'chat'/);
  assert.match(js, /function localSmallTalkReply\(question\)/);
  assert.match(js, /Amigo fallback/);
});

test('the redesigned chat has responsive and reduced-motion layouts', () => {
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 580px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /body\.is-empty \.scroll \{ justify-content: center; \}/);
});


test('Amigo visibly animates during progress and answer reveal, with a reduced-motion fallback', () => {
  assert.match(js, /amigo-avatar is-active/);
  assert.match(js, /meta.classList.add\('is-speaking'\)/);
  assert.match(js, /typeOut\(body, a.answer, prefix, \(/);
  assert.match(amigoCss, /@keyframes amigo-orbit/);
  assert.match(amigoCss, /prefers-reduced-motion: reduce/);
});

test('article media groups and native source galleries use a responsive grid', () => {
  assert.match(articleJs, /function arrangeArticleMedia\(root\)/);
  assert.match(articleJs, /article-gallery-grid/);
  assert.match(uiCss, /grid-template-columns: repeat\(auto-fit/);
  assert.match(uiCss, /gallerybox/);
});

test('the chat shell uses the Amigo refinement layers and one identity', () => {
  const layers = stylesheetOrder('chat/index.html');
  assert.ok(layers.includes('amigo-ui.css'), `amigo-ui.css missing from ${layers.join(' > ')}`);
  assert.ok(layers.includes('amigo-chat.css'), `amigo-chat.css missing from ${layers.join(' > ')}`);
  assert.match(html, /Hi, I’m <em>Amigo<\/em>/);
  assert.doesNotMatch(html, /<em>Indus<\/em>/);
});


test('chat history uses bounded local storage with an honest session fallback', () => {
  assert.ok(js.includes('const MAX_STORED_THREADS = 16'));
  assert.ok(js.includes('const MAX_STORED_MESSAGES = 20'));
  assert.ok(js.includes('function compactMessagesForStorage'));
  assert.ok(js.includes('saveChatState('));
  assert.ok(js.includes('readChatBackup('));
  assert.ok(js.includes('showChatStorageNotice(result.mode)'));
});

test('chat has no account or profile requirement and explains context sharing', () => {
  assert.match(html, /No sign-in, email, phone number or personal profile is required/);
  assert.match(html, /up to eight recent turns from the active chat are/);
  assert.match(html, /Technical request data may be processed by the hosting service/);
});


test('an explicitly selected New chat stays empty after reload', () => {
  assert.ok(js.includes('activeThreadWasStored = chatSessionBackup !== null || storedActiveThread !== null'));
  assert.match(js, /recent\.length && !activeThreadWasStored/);
  assert.match(js, /An explicitly empty key means the reader chose New chat/);
});


test('saved view does not replace an in-flight answer', () => {
  assert.match(js, /function showSaved\(\) \{\s*if \(busy\)/);
  assert.match(js, /Stop the current response before opening Saved/);
});


test('Amigo chat uses an AI-mode conversation hierarchy without replacing its theme', () => {
  assert.match(experienceCss, /AMIGO CONVERSATION MODE/);
  assert.match(experienceCss, /\.a \{/);
  assert.match(experienceCss, /\.chat-mode-tabs/);
  assert.match(experienceCss, /\.working/);
  assert.match(experienceCss, /\.src-cards/);
  assert.match(experienceCss, /@media \(max-width: 900px\)/);
  assert.match(experienceCss, /prefers-reduced-motion: reduce/);
  assert.match(experienceCss, /var\(--im-accent\)/);
  assert.match(experienceCss, /var\(--im-surface\)/);
});


test('streaming replaces the searching avatar before mounting the writing avatar', () => {
  const chatBranch = js.indexOf("if (route === 'chat')");
  const chatWriting = js.indexOf("label.textContent = t('writing');", chatBranch);
  const chatRemoval = js.indexOf("working.remove();", chatWriting);
  const chatPreview = js.indexOf("livePreview = createStreamPreview();", chatWriting);
  assert.ok(chatBranch >= 0 && chatWriting > chatBranch);
  assert.ok(chatRemoval > chatWriting && chatRemoval < chatPreview);
  const researchWriting = js.indexOf("label.textContent = t('writing');", chatPreview);
  const researchRemoval = js.indexOf("working.remove();", researchWriting);
  const researchPreview = js.indexOf("if (!livePreview) livePreview = createStreamPreview();", researchWriting);
  assert.ok(researchRemoval > researchWriting && researchRemoval < researchPreview);
});

test('chat persistence has a session fallback and reports failures to the reader', () => {
  assert.match(js, /import \{ readChatBackup, saveChatState \} from '\.\/chat-storage\.js'/);
  assert.match(js, /saveChatState\(/);
  assert.match(js, /showChatStorageNotice\(result\.mode\)/);
  assert.match(js, /Persistent browser storage is unavailable/);
  assert.match(js, /This chat could not be saved/);
});
