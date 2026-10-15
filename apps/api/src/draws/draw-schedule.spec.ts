import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawTimeFor, nextDrawTime } from './draw-schedule.js';

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

test('a draw delay overrides the time of day', () => {
  const filledAt = new Date('2026-10-15T10:00:00Z');
  const at = drawTimeFor({ filledAt, drawTimeOfDay: '18:00', timezone: tz, drawDelayMinutes: 5 });
  assert.equal(at.toISOString(), '2026-10-15T10:05:00.000Z');
});

test('without a delay the time of day applies', () => {
  const filledAt = new Date('2026-10-15T10:00:00Z');
  const at = drawTimeFor({ filledAt, drawTimeOfDay: '18:00', timezone: tz, drawDelayMinutes: null });
  assert.equal(at.toISOString(), '2026-10-15T17:00:00.000Z');
});
