import { z } from 'zod';

// Validation shared by the API, the web app and (later) the mobile app, so a
// form rejects exactly what the server rejects.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const MINIMUM_AGE_YEARS = 18;

/** CIN scans: at most 5 MB each, JPEG, PNG or WebP. */
export const IDENTITY_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const IDENTITY_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type IdentityDocumentMimeType = (typeof IDENTITY_DOCUMENT_MIME_TYPES)[number];

/** Uppercases and strips spaces and dashes: "ab 123-456" → "AB123456". */
export function normalizeCinNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** Moroccan CIN: one or two letters followed by up to six digits, e.g. "A123456" or "BK12345". */
export const CIN_NUMBER_PATTERN = /^[A-Z]{1,2}[0-9]{1,6}$/;

/** Accepts 06XXXXXXXX, 6XXXXXXXX or +2126XXXXXXXX (also 05/07) and returns +212XXXXXXXXX. */
export function normalizeMoroccanPhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, '');
  const match = /^(?:\+212|00212|0)?([5-7][0-9]{8})$/.exec(digits);
  return match ? `+212${match[1]}` : null;
}

/** Parses a strict YYYY-MM-DD calendar date as UTC midnight, or returns null. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? date : null;
}

/** Whole years between a YYYY-MM-DD birth date and `today` (UTC). */
export function ageOn(birthDate: Date, today: Date): number {
  const age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** A string field that says "Required" instead of zod's type error when it is missing. */
const text = (message = 'Required') => z.string({ error: message });

const email = text('Enter your email').trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));

export const registerSchema = z.object({
  email,
  password: text('Choose a password')
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const phone = normalizeMoroccanPhone(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'Enter a Moroccan phone number, e.g. 0612345678' });
        return z.NEVER;
      }
      return phone;
    }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: text('Enter your password').min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.input<typeof loginSchema>;

const name = text().trim().min(1, 'Required').max(100);

/** CIN details sent alongside the front and back scans. Dates are YYYY-MM-DD. */
export const identitySchema = z.object({
  firstName: name,
  lastName: name,
  dateOfBirth: text().transform((value, ctx) => {
    const date = parseIsoDate(value);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'Use the format YYYY-MM-DD' });
      return z.NEVER;
    }
    if (ageOn(date, todayUtc()) < MINIMUM_AGE_YEARS) {
      ctx.addIssue({ code: 'custom', message: `You must be at least ${MINIMUM_AGE_YEARS} years old` });
      return z.NEVER;
    }
    return date;
  }),
  cinNumber: text()
    .transform(normalizeCinNumber)
    .pipe(z.string().regex(CIN_NUMBER_PATTERN, 'Enter the CIN number as printed, e.g. AB123456')),
  cinExpiresAt: text().transform((value, ctx) => {
    const date = parseIsoDate(value);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'Use the format YYYY-MM-DD' });
      return z.NEVER;
    }
    if (date < todayUtc()) {
      ctx.addIssue({ code: 'custom', message: 'This CIN has expired' });
      return z.NEVER;
    }
    return date;
  }),
});
export type IdentityInput = z.input<typeof identitySchema>;

export const rejectVerificationSchema = z.object({
  reason: text('Tell the user why, so they can fix it').trim().min(3, 'Tell the user why, so they can fix it').max(500),
});
export type RejectVerificationInput = z.input<typeof rejectVerificationSchema>;

export const suspendUserSchema = z.object({
  reason: text('Give a reason').trim().min(3, 'Give a reason').max(500),
});
export type SuspendUserInput = z.input<typeof suspendUserSchema>;
