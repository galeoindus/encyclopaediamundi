import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, __test as askTest } from '../functions/api/ask.js';
import { onRequestPost as onSpeechPost } from '../functions/api/speech.js';

let nextIp = 10;
function post(path, body, extra = {}) {
  const ip = `198.51.100.${nextIp++}`;
  return new Request(`https://veridell.pages.dev/api/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://veridell.pages.dev',
      'cf-connecting-ip': ip,
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

function textStream(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const evidence = [{
  title: 'Ashoka',
  text: 'Ashoka was an ancient Indian emperor of the Maurya dynasty.',
  url: 'https://en.wikipedia.org/wiki/Ashoka',
  sourceType: 'Wikipedia',
}];

test('chat endpoint streams deltas and ends with a complete final event', async () => {
  const calls = [];
  const response = await onRequestPost({
    request: post('ask', { question: 'Hello Amigo', mode: 'chat', depth: 'quick', stream: true }),
    env: {
      AI: { run: async (model, options) => {
        calls.push({ model, options });
        return textStream([
          'data: {"response":"Hello " }\n\n',
          'data: {"response":"there!"}\n\n',
          'data: [DONE]\n\n',
        ]);
      } },
    },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const events = (await response.text()).split(/\r?\n/).filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  assert.deepEqual(events.map((event) => event.type), ['delta', 'delta', 'done']);
  assert.equal(events[2].answer, 'Hello there!');
  assert.equal(events[2].mode, 'chat');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.stream, true);
});

test('grounded stream returns only real, numbered citations in its final source map', async () => {
  const response = await onRequestPost({
    request: post('ask', {
      question: 'Who was Ashoka?',
      mode: 'grounded',
      depth: 'quick',
      stream: true,
      passages: evidence,
    }),
    env: {
      AI: { run: async (_model, options) => {
        assert.equal(options.stream, true);
        return textStream([
          'data: {"response":"Ashoka was a Mauryan emperor [1]."}\n\n',
          'data: [DONE]\n\n',
        ]);
      } },
    },
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).split(/\r?\n/).filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  const done = events.at(-1);
  assert.equal(done.type, 'done');
  assert.equal(done.sources.length, 1);
  assert.equal(done.sources[0].url, 'https://en.wikipedia.org/wiki/Ashoka');
  assert.equal(done.sources[0].cited, true);
  assert.match(done.answer, /\[1\]/);
});

test('grounded streaming falls back to a non-stream retry when the first stream has no citation', async () => {
  let call = 0;
  const response = await onRequestPost({
    request: post('ask', {
      question: 'Who was Ashoka?',
      mode: 'grounded',
      depth: 'quick',
      stream: true,
      passages: evidence,
    }),
    env: {
      AI: { run: async (_model, options) => {
        call += 1;
        if (options.stream) {
          return textStream(['data: {"response":"Ashoka was an emperor."}\n\n', 'data: [DONE]\n\n']);
        }
        return { response: 'Ashoka was a Mauryan emperor [1].' };
      } },
    },
  });
  const events = (await response.text()).split(/\r?\n/).filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  assert.equal(call, 2);
  assert.ok(events.some((event) => event.type === 'replace' && /\[1\]/.test(event.text)));
  assert.equal(events.at(-1).type, 'done');
  assert.equal(events.at(-1).sources[0].cited, true);
});

test('speech endpoint accepts same-origin English and returns uncached MP3 audio', async () => {
  const calls = [];
  const audio = new Uint8Array([73, 68, 51, 4, 5, 6]);
  const response = await onSpeechPost({
    request: post('speech', { text: 'A clear answer to read aloud.', language: 'en' }),
    env: { AI: { run: async (model, input, options) => {
      calls.push({ model, input, options });
      return new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });
    } } },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /audio\/mpeg/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [...audio]);
  assert.equal(calls[0].model, '@cf/deepgram/aura-2-en');
  assert.equal(calls[0].input.speaker, 'asteria');
  assert.equal(calls[0].options.returnRawResponse, true);
});

test('speech endpoint rejects cross-origin and non-English requests', async () => {
  let calls = 0;
  const env = { AI: { run: async () => { calls += 1; return new Response(''); } } };
  const crossOrigin = await onSpeechPost({
    request: post('speech', { text: 'Hello', language: 'en' }, { origin: 'https://attacker.example' }),
    env,
  });
  assert.equal(crossOrigin.status, 403);
  const hindi = await onSpeechPost({
    request: post('speech', { text: 'नमस्ते', language: 'hi' }),
    env,
  });
  assert.equal(hindi.status, 422);
  assert.equal(calls, 0);
});

test('speech endpoint bounds text length and refuses to claim success without AI binding', async () => {
  const tooLong = await onSpeechPost({
    request: post('speech', { text: 'A'.repeat(1201), language: 'en' }),
    env: { AI: { run: async () => new Response('') } },
  });
  assert.equal(tooLong.status, 413);
  const unavailable = await onSpeechPost({
    request: post('speech', { text: 'Hello', language: 'en' }),
    env: {},
  });
  assert.equal(unavailable.status, 503);
});


test('Amigo chat prompt knows the site map and accurately describes scholarly-source limits', () => {
  const system = askTest.makeChatMessages('What can I do on this website?')[0].content;
  for (const path of ['/topics/', '/articles/', '/questions/', '/research/', '/how-it-works/', '/help/', '/chat/']) {
    assert.ok(system.includes(path), `site route missing: ${path}`);
  }
  assert.match(system, /Crossref and OpenAlex/);
  assert.match(system, /bibliographic records and abstracts/);
  assert.match(system, /does not promise to host or download every paper/);
  assert.match(system, /Do not claim cross-device sync/);
});
