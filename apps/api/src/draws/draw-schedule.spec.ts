import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextDrawTime } from './draw-schedule.js';

const tz = 'Africa/Casablanca';

test('target reached before 18:00 draws the same day', () => {
  // 2026-10-15 10:00 UTC is 11:00 in Casablanca (UTC+1).
  const at = nextDrawTime(new Date('2026-10-15T10:00:00Z'), '18:00', tz);
  assert.equal(at.toISOString(), '2026-10-15T17:00:00.000Z');
});

test('target reached after 18:00 draws the next day', () => {
  const at = nextDrawTime(new Date('2026-10-15T17:30:00Z'), '18:00', tz);
  assert.equal(at.toISOString(), '2026-10-16T17:00:00.000Z');
});
