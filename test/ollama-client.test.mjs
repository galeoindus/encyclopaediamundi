import test from 'node:test';
import assert from 'node:assert/strict';
import { OLLAMA_ORIGIN, DEFAULT_OLLAMA_MODEL, toOllamaImage } from '../assets/js/ollama-client.js';

test('local inference is pinned to the loopback interface, not an imported remote URL', () => {
  assert.equal(OLLAMA_ORIGIN, 'http://127.0.0.1:11434');
  assert.equal(DEFAULT_OLLAMA_MODEL, 'qwen2.5:1.5b');
  assert.equal(OLLAMA_ORIGIN.includes('https://'), false);
});

test('only base64 PNG, JPEG and WebP data URLs are accepted for local vision', () => {
  assert.equal(toOllamaImage('data:image/png;base64,SGVsbG8='), 'SGVsbG8=');
  assert.equal(toOllamaImage('data:image/jpeg;base64,AAAA'), 'AAAA');
  assert.equal(toOllamaImage('data:image/webp;base64,AAAA'), 'AAAA');
  assert.equal(toOllamaImage('https://example.com/image.png'), '');
  assert.equal(toOllamaImage('data:image/svg+xml;base64,AAAA'), '');
  assert.equal(toOllamaImage('data:text/plain;base64,AAAA'), '');
});

test('site CSP allows only the fixed loopback Ollama endpoint', async () => {
  const { readFile } = await import('node:fs/promises');
  const headers = await readFile(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /connect-src[^\n]*http:\/\/127\.0\.0\.1:11434/);
  assert.doesNotMatch(headers, /connect-src[^\n]*http:\/\/localhost:11434/);
});
