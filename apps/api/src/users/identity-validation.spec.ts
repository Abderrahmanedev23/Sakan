import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageOn, identitySchema, normalizeMoroccanPhone, parseIsoDate, registerSchema } from '@sakan/shared';

const valid = {
  firstName: ' Amina ',
  lastName: 'El Idrissi',
  dateOfBirth: '1990-04-12',
  cinNumber: 'bk 123-456',
  cinExpiresAt: '2099-01-01',
};

test('CIN details are trimmed and the CIN number normalised', () => {
  const parsed = identitySchema.parse(valid);
  assert.equal(parsed.firstName, 'Amina');
  assert.equal(parsed.cinNumber, 'BK123456');
  assert.equal(parsed.dateOfBirth.toISOString(), '1990-04-12T00:00:00.000Z');
});

test('malformed CIN numbers, impossible dates, minors and expired cards are rejected', () => {
  assert.equal(identitySchema.safeParse({ ...valid, cinNumber: '123456' }).success, false);
  assert.equal(identitySchema.safeParse({ ...valid, cinNumber: 'ABC1234' }).success, false);
  assert.equal(identitySchema.safeParse({ ...valid, dateOfBirth: '1990-02-30' }).success, false);
  assert.equal(identitySchema.safeParse({ ...valid, dateOfBirth: '2020-01-01' }).success, false);
  assert.equal(identitySchema.safeParse({ ...valid, cinExpiresAt: '2001-01-01' }).success, false);
});

test('age counts whole years and respects the birthday', () => {
  const birth = parseIsoDate('2008-10-15')!;
  assert.equal(ageOn(birth, parseIsoDate('2026-10-14')!), 17);
  assert.equal(ageOn(birth, parseIsoDate('2026-10-15')!), 18);
});

test('Moroccan phone numbers normalise to +212', () => {
  assert.equal(normalizeMoroccanPhone('06 12 34 56 78'), '+212612345678');
  assert.equal(normalizeMoroccanPhone('+212712345678'), '+212712345678');
  assert.equal(normalizeMoroccanPhone('0812345678'), null);
});

test('registration lowercases the email and requires a long enough password', () => {
  assert.equal(registerSchema.parse({ email: ' A@B.ma ', password: 'long enough pw' }).email, 'a@b.ma');
  assert.equal(registerSchema.safeParse({ email: 'a@b.ma', password: 'short' }).success, false);
});
