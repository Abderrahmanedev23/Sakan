import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password.js';

test('a hashed password verifies and a wrong one does not', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.match(stored, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('correct horse batterz', stored), false);
});

test('the same password hashes differently each time', async () => {
  assert.notEqual(await hashPassword('same password'), await hashPassword('same password'));
});

test('a malformed stored hash never verifies', async () => {
  assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
});
