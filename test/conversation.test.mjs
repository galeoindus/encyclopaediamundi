import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMessage, conversationHistory, contextualSearchQuery, isSmallTalk, normalizeStoredThread } from '../assets/js/conversation.js';

test('Auto mode routes greetings and everyday courtesy to conversation', () => {
  assert.equal(classifyMessage('नमस्ते Amigo!'), 'chat');
  assert.equal(classifyMessage('How are you?'), 'chat');
  assert.equal(classifyMessage('Thank you'), 'chat');
  assert.equal(classifyMessage('Hello, how are you?'), 'chat');
  assert.equal(classifyMessage('Hi there, Amigo!'), 'chat');
  assert.equal(classifyMessage('Thanks, Amigo!'), 'chat');
  assert.equal(isSmallTalk('hi'), true);
  assert.equal(isSmallTalk('What can you do about climate change?'), false);
});

test('Auto mode sends factual questions to source-grounded research', () => {
  assert.equal(classifyMessage('Who was Ashoka?'), 'grounded');
  assert.equal(classifyMessage('How does photosynthesis work?'), 'grounded');
  assert.equal(classifyMessage('Explain quantum entanglement.'), 'grounded');
});

test('Auto mode handles writing, creative work and rephrasing conversationally', () => {
  assert.equal(classifyMessage('Write a short poem about rain.'), 'chat');
  assert.equal(classifyMessage('Help me plan a study routine.'), 'chat');
  assert.equal(classifyMessage('Make that simpler.'), 'chat');
  assert.equal(classifyMessage('Could you please create a weekly checklist?'), 'chat');
  assert.equal(classifyMessage('मुझे एक कविता लिखकर दीजिए।'), 'chat');
  assert.equal(classifyMessage('मुझे आपसे बात करनी है।'), 'chat');
  assert.equal(classifyMessage('I got a new job today!'), 'chat');
  assert.equal(classifyMessage('My day was exhausting.'), 'chat');
  assert.equal(classifyMessage('I want to understand how solar panels work.'), 'grounded');
});

test('explicit modes override Auto routing', () => {
  assert.equal(classifyMessage('Who was Ashoka?', 'chat'), 'chat');
  assert.equal(classifyMessage('Write a poem.', 'research'), 'grounded');
});

test('contextual research follow-ups include the previous topic in Wikipedia search', () => {
  const items = [
    { type: 'q', text: 'Who was Ashoka?' },
    { type: 'a', data: { title: 'Ashoka', answer: 'Ashoka was an emperor.' } },
  ];
  assert.equal(contextualSearchQuery('And why?', items), 'Ashoka And why?');
  assert.equal(contextualSearchQuery('What is photosynthesis?', items), 'What is photosynthesis?');
});

test('conversation history is built from the active thread, not other saved chats', () => {
  const history = conversationHistory([
    { type: 'q', text: 'Hello' },
    { type: 'a', data: { answer: 'Hi!' } },
    { type: 'q', text: 'Write a poem' },
  ]);
  assert.deepEqual(history, [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi!' },
    { role: 'user', content: 'Write a poem' },
  ]);
});

test('stored legacy question-answer entries migrate into thread format', () => {
  const thread = normalizeStoredThread({ q: 'Hello', at: 100, answer: { answer: 'Hi!' } }, () => 'thread-1');
  assert.equal(thread.id, 'thread-1');
  assert.deepEqual(thread.messages.map((m) => m.type), ['q', 'a']);
});


test('questions about Veridell and how to use the website stay in site-aware chat mode', () => {
  assert.equal(classifyMessage('What can I do on this website?'), 'chat');
  assert.equal(classifyMessage('How does Veridell work?'), 'chat');
  assert.equal(classifyMessage('Tell me about Veridell privacy and research features.'), 'chat');
  assert.equal(classifyMessage('इस वेबसाइट पर क्या-क्या कर सकते हैं?'), 'chat');
  assert.equal(classifyMessage('What research papers can I find on climate change?'), 'grounded');
  assert.equal(classifyMessage('How does Veridell work?', 'research'), 'grounded');
});
