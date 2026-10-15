import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashEntries, pickWinnerIndexes, sha256 } from './draw-selection.js';

test('selection is deterministic for the same seed and entries', () => {
  const entriesHash = hashEntries(['A', 'B', 'C', 'D']);
  assert.deepEqual(pickWinnerIndexes('seed', entriesHash, 4, 2), pickWinnerIndexes('seed', entriesHash, 4, 2));
});

test('selection returns distinct in-range indexes', () => {
  const winners = pickWinnerIndexes(sha256('x'), hashEntries(['A', 'B', 'C']), 3, 3);
  assert.deepEqual([...winners].sort(), [0, 1, 2]);
});

test('selection rejects empty sessions', () => {
  assert.throws(() => pickWinnerIndexes('seed', 'h', 0, 1));
});
