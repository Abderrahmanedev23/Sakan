import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectImageType } from './file-type.js';

test('detects JPEG, PNG and WebP from their signatures', () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(detectImageType(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1')), 'image/webp');
});

test('rejects other content whatever its name', () => {
  assert.equal(detectImageType(Buffer.from('%PDF-1.7')), null);
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});
