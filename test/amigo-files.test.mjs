import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FILE_BYTES, MAX_TOTAL_FILE_BYTES, MAX_ATTACHMENT_COUNT, MAX_IMAGE_COUNT,
  isSupportedFile, buildAttachmentMessages,
} from '../assets/js/amigo-files.js';

test('attachment limits protect low-memory devices and keep image count bounded', () => {
  assert.equal(MAX_FILE_BYTES, 4 * 1024 * 1024);
  assert.equal(MAX_TOTAL_FILE_BYTES, 8 * 1024 * 1024);
  assert.equal(MAX_ATTACHMENT_COUNT, 4);
  assert.equal(MAX_IMAGE_COUNT, 2);
});

test('only explicit document, PDF and image types are supported', () => {
  assert.equal(isSupportedFile({ name: 'notes.md' }), true);
  assert.equal(isSupportedFile({ name: 'paper.pdf', type: 'application/pdf' }), true);
  assert.equal(isSupportedFile({ name: 'diagram.png', type: 'image/png' }), true);
  assert.equal(isSupportedFile({ name: 'program.exe', type: 'application/octet-stream' }), false);
});

test('text extraction sent to the model is length bounded and excludes image bytes', () => {
  const parts = buildAttachmentMessages([
    { name: 'notes.txt', kind: 'text', text: 'A'.repeat(20_000) },
    { name: 'image.png', kind: 'image', dataUrl: 'data:image/png;base64,AAAA' },
  ]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].text.length, 12_000);
  assert.equal(parts[0].name, 'notes.txt');
});
