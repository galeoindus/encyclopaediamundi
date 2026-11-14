import test from 'node:test';
import assert from 'node:assert/strict';

import { isSiteQuestion, siteAnswerMarkdown, SITE_PAGES, SITE_CONTEXT, SITE_FACTS } from '../assets/js/site-knowledge.js';
import { routeFor } from '../functions/api/ask.js';

test('questions about Veridell are recognised as site questions', () => {
  for (const q of [
    'What is Veridell?',
    'How does this site work?',
    'Does Veridell store my data?',
    'Where are the sources?',
    'Is this website free?',
    'वेरिडेल क्या है?',
    'इस साइट के बारे में बताइए',
  ]) assert.equal(isSiteQuestion(q), true, q);
});

test('ordinary research questions are not mistaken for site questions', () => {
  for (const q of [
    'What is a black hole?',
    'Who was Ashoka?',
    'How does photosynthesis work?',
    'प्रकाश संश्लेषण कैसे होता है?',
  ]) assert.equal(isSiteQuestion(q), false, q);
});

test('a site answer links to the pages it names', () => {
  const answer = siteAnswerMarkdown('Where is the library page?', 'en');
  assert.match(answer, /\[Library\]\(\/#\/library\)/);
  assert.match(answer, /\[Articles\]\(\/articles\/\)/);
  // Every page in the index is reachable from the answer.
  for (const page of SITE_PAGES) assert.ok(answer.includes(`](${page.path})`), page.path);
});

test('a site answer carries no dead citation markers', () => {
  const answer = siteAnswerMarkdown('What is Veridell and is it free?', 'en');
  // The chat turns [n] into a link to a source card; a site answer has no
  // source cards, so it must never contain one.
  assert.doesNotMatch(answer, /\[\d{1,2}\]/);
});

test('the privacy question is answered from the privacy facts', () => {
  const answer = siteAnswerMarkdown('Does Veridell store my chat history?', 'en');
  assert.match(answer, /## Your data/);
  assert.ok(answer.includes(SITE_FACTS.privacy.slice(0, 40)));
});

test('site answers exist in Hindi too', () => {
  const answer = siteAnswerMarkdown('वेरिडेल क्या है?', 'hi');
  assert.match(answer, /Veridell/);
  assert.match(answer, /## (मुख्य बातें|पेज)/);
});

test('the prompt context states the product facts a model may use', () => {
  assert.match(SITE_CONTEXT, /VERIDELL PRODUCT FACTS/);
  assert.ok(SITE_CONTEXT.includes(SITE_FACTS.sources.slice(0, 30)));
  assert.match(SITE_CONTEXT, /Site version: \d+\.\d+\.\d+/);
});

test('Auto routes a greeting to the lightest band', () => {
  const route = routeFor({ question: 'hi there', mode: 'chat', depth: 'detailed' });
  assert.equal(route.path, 'chat');
  assert.equal(route.band, 'light');
  assert.equal(route.depth, 'quick');
});

test('Auto routes a long, multi-part question to the heavier band', () => {
  const route = routeFor({
    question: 'Compare the ISRO Chandrayaan-2 and Chandrayaan-3 missions, and explain in depth what the evidence from each shows about the landing.',
    mode: 'chat',
    depth: 'detailed',
  });
  assert.equal(route.band, 'normal');
  assert.equal(route.depth, 'detailed');
});

test('Deep depth is never answered by the lightest model', () => {
  const route = routeFor({ question: 'What is a black hole?', mode: 'grounded', depth: 'deep' });
  assert.equal(route.band, 'heavy');
  assert.equal(route.depth, 'deep');
});

test('a short factual question stays on the cheap grounded path', () => {
  const route = routeFor({ question: 'What is a black hole?', mode: 'grounded', depth: 'detailed' });
  assert.equal(route.path, 'research');
  assert.equal(route.band, 'normal');
});
