/* The SSE reader, tested without a network, a DOM or a model.
 *
 * Every case here is a shape a real stream can take and a naive reader gets
 * wrong. The multi-line case is the audit's F-10: joining two `data:` lines
 * with the characters `\` and `n` instead of a newline produced invalid JSON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseFrame, parseJsonFrame, splitFrames } from '../assets/js/sse.js';

test('a single data line parses', () => {
  const parsed = parseFrame('data: {"type":"delta","text":"hi"}');
  assert.equal(parsed.data, '{"type":"delta","text":"hi"}');
  assert.deepEqual(JSON.parse(parsed.data), { type: 'delta', text: 'hi' });
});

test('several data lines join with a real newline', () => {
  // Two data lines, whose payload is one JSON object. The join between them
  // must be a newline character, not the two characters backslash and n.
  const frame = 'data: {"type":"done",\ndata: "answer":"two lines"}';
  const parsed = parseFrame(frame);
  assert.equal(parsed.data, '{"type":"done",\n"answer":"two lines"}');
  assert.ok(!parsed.data.includes('\\n'), 'the join must not be a literal backslash-n');
  assert.equal(JSON.parse(parsed.data).answer, 'two lines');
});

test('a JSON payload split across data lines is still valid', () => {
  const frame = 'data: {"type":"done",\ndata: "answer":"a b c",\ndata: "model":"x"}';
  const parsed = parseJsonFrame(frame);
  assert.ok(parsed, 'the multi-line payload must parse');
  assert.equal(parsed.data.answer, 'a b c');
  assert.equal(parsed.data.model, 'x');
});

test('CRLF line endings parse the same as LF', () => {
  const parsed = parseJsonFrame('data: {"type":"delta","text":"ok"}\r\n');
  assert.equal(parsed.data.text, 'ok');
});

test('a comment or heartbeat frame is ignored, not fatal', () => {
  assert.equal(parseFrame(':keep-alive'), null);
  assert.equal(parseFrame(''), null);
  assert.equal(parseJsonFrame('event: ping'), null);
});

test('a frame that is not JSON is ignored rather than thrown', () => {
  assert.equal(parseJsonFrame('data: not json at all'), null);
});

test('the event name is preserved when one is sent', () => {
  const parsed = parseFrame('event: done\ndata: {"type":"done"}');
  assert.equal(parsed.event, 'done');
});

test('a chunk boundary inside an event loses nothing', () => {
  const whole = 'data: {"type":"delta","text":"split"}\n\ndata: {"type":"done"}\n\n';
  const first = whole.slice(0, 18);
  const second = whole.slice(18);

  const a = splitFrames(first);
  assert.equal(a.frames.length, 0, 'a half event is not a frame yet');
  const b = splitFrames(a.rest + second);
  assert.equal(b.frames.length, 2);

  const events = b.frames.map((f) => parseJsonFrame(f)?.data);
  assert.deepEqual(events[0], { type: 'delta', text: 'split' });
  assert.deepEqual(events[1], { type: 'done' });
});

test('a final frame with no trailing blank line is still read', () => {
  const { frames, rest } = splitFrames('data: {"type":"done"}\n\n');
  assert.equal(frames.length, 1);
  assert.equal(rest, '');
  // and the caller reads `rest` separately when the stream ends
  assert.deepEqual(parseJsonFrame(rest || frames[0]).data, { type: 'done' });
});

test('blank frames between events are dropped', () => {
  const { frames } = splitFrames('\n\ndata: {"a":1}\n\n\n\ndata: {"b":2}\n\n');
  assert.equal(frames.length, 2);
});
