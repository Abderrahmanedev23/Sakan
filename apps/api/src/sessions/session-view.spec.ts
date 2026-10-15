import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAcceptingEntries, maskName } from './session-view.js';

const base = {
  status: 'OPEN' as string,
  allowOverfill: false,
  confirmedEntries: 5,
  targetEntries: 10,
  opensAt: null as Date | null,
  closesAt: null as Date | null,
  drawScheduledAt: null as Date | null,
};
// Only the fields isAcceptingEntries reads matter here.
const session = (overrides: Partial<typeof base>) => ({ ...base, ...overrides }) as never;
const now = new Date('2026-10-15T12:00:00Z');

test('an open session with room accepts entries', () => {
  assert.equal(isAcceptingEntries(session({}), now), true);
});

test('a full session without overfill does not', () => {
  assert.equal(isAcceptingEntries(session({ confirmedEntries: 10 }), now), false);
});

test('paused, draft and closed sessions do not', () => {
  assert.equal(isAcceptingEntries(session({ status: 'PAUSED' }), now), false);
  assert.equal(isAcceptingEntries(session({ status: 'DRAFT' }), now), false);
  assert.equal(isAcceptingEntries(session({ closesAt: new Date('2026-10-15T11:00:00Z') }), now), false);
  assert.equal(isAcceptingEntries(session({ opensAt: new Date('2026-10-15T13:00:00Z') }), now), false);
});

test('overfill keeps selling while scheduled, until a minute before the draw', () => {
  const scheduled = { status: 'SCHEDULED', allowOverfill: true, confirmedEntries: 12 };
  assert.equal(isAcceptingEntries(session({ ...scheduled, drawScheduledAt: new Date('2026-10-15T12:05:00Z') }), now), true);
  assert.equal(isAcceptingEntries(session({ ...scheduled, drawScheduledAt: new Date('2026-10-15T12:00:30Z') }), now), false);
});

test('winner names are masked to first name and initial', () => {
  assert.equal(maskName('Youssef', 'alaoui'), 'Youssef A.');
  assert.equal(maskName('Salma', null), 'Salma');
});
