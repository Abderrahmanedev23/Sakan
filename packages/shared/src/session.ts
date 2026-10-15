import { z } from 'zod';
import type { DrawStatus, EntryStatus, PaymentStatus, SessionStatus } from './enums.js';

/** Allowed session status transitions. Anything not listed is rejected. */
export const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['PAUSED', 'FULL', 'CANCELLED'],
  // PAUSED → FULL is "close early and draw with the entries so far".
  PAUSED: ['OPEN', 'FULL', 'CANCELLED'],
  FULL: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

/** How long a started payment holds a place in a session before it expires. */
export const PAYMENT_HOLD_MINUTES = 15;

/** Public entry reference: session number and position, e.g. SKN-0001-000042. */
export function formatEntryReference(sessionNumber: number, sequence: number): string {
  return `SKN-${String(sessionNumber).padStart(4, '0')}-${String(sequence).padStart(6, '0')}`;
}

export const DRAW_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const optionalDateTime = z
  .union([z.iso.datetime({ offset: true, error: 'Use a full date and time' }), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : value === undefined ? undefined : null));

const sessionFields = {
  name: z.string({ error: 'Give the session a name' }).trim().min(3, 'Use at least 3 characters').max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => value || null),
  /** Price of one entry in centimes (100 MAD = 10000). */
  entryPriceCents: z.coerce
    .number({ error: 'Enter a price' })
    .int('Use whole centimes')
    .min(100, 'The minimum price is 1 MAD')
    .max(100_000_000),
  targetEntries: z.coerce.number({ error: 'Enter a target' }).int().min(1, 'At least 1 entry').max(1_000_000),
  winnerCount: z.coerce.number().int().min(1).max(100),
  maxEntriesPerUser: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .nullish()
    .transform((value) => value ?? null),
  allowOverfill: z.boolean(),
  drawTimeOfDay: z.string().regex(DRAW_TIME_PATTERN, 'Use HH:mm, e.g. 18:00'),
  timezone: z.string().refine(isTimeZone, 'Unknown time zone'),
  /** When set, the draw runs this many minutes after the session fills, instead of at drawTimeOfDay. */
  drawDelayMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(7 * 24 * 60)
    .nullish()
    .transform((value) => value ?? null),
  opensAt: optionalDateTime,
  closesAt: optionalDateTime,
};

function checkSession(
  value: { winnerCount?: number; targetEntries?: number; opensAt?: Date | null; closesAt?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (value.winnerCount !== undefined && value.targetEntries !== undefined && value.winnerCount > value.targetEntries) {
    ctx.addIssue({ code: 'custom', path: ['winnerCount'], message: 'More winners than entries' });
  }
  if (value.opensAt && value.closesAt && value.closesAt <= value.opensAt) {
    ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Must be after the opening time' });
  }
}

/** Body of POST /admin/sessions. */
export const createSessionSchema = z
  .object({
    ...sessionFields,
    winnerCount: sessionFields.winnerCount.default(1),
    allowOverfill: sessionFields.allowOverfill.default(false),
    drawTimeOfDay: sessionFields.drawTimeOfDay.default('18:00'),
    timezone: sessionFields.timezone.default('Africa/Casablanca'),
  })
  .superRefine(checkSession);
export type CreateSessionInput = z.input<typeof createSessionSchema>;

/** Body of PATCH /admin/sessions/:id. Only name and description can change once a session is open. */
export const updateSessionSchema = z.object(sessionFields).partial().superRefine(checkSession);
export type UpdateSessionInput = z.input<typeof updateSessionSchema>;

/** Body of POST /admin/sessions/:id/cancel and of payment refunds. */
export const reasonSchema = z.object({
  reason: z.string({ error: 'Give a reason' }).trim().min(3, 'Give a reason').max(500),
});
export type ReasonInput = z.input<typeof reasonSchema>;

/** One winner as shown publicly: the entry reference and a masked name (e.g. "Youssef A."). */
export interface PublicWinner {
  position: number;
  entryReference: string;
  displayName: string;
}

/**
 * The draw of a session. `seed` stays null until the draw is completed; before that only
 * `seedHash` is public, which commits the platform to the seed in advance.
 */
export interface PublicDraw {
  status: DrawStatus;
  scheduledAt: string;
  seedHash: string;
  seed: string | null;
  entriesHash: string | null;
  entryCount: number | null;
  completedAt: string | null;
  winners: PublicWinner[];
}

/** Public view of a draw session, as returned by GET /api/v1/sessions and /sessions/:id. */
export interface PublicSession {
  id: string;
  number: number;
  name: string;
  description: string | null;
  status: SessionStatus;
  /** Price per entry in the smallest currency unit (centimes for MAD). */
  entryPriceCents: number;
  currency: string;
  targetEntries: number;
  confirmedEntries: number;
  winnerCount: number;
  maxEntriesPerUser: number | null;
  allowOverfill: boolean;
  drawTimeOfDay: string;
  timezone: string;
  drawDelayMinutes: number | null;
  opensAt: string | null;
  closesAt: string | null;
  filledAt: string | null;
  drawScheduledAt: string | null;
  createdAt: string;
  /** Whether a signed-in, approved user could buy an entry right now. */
  acceptingEntries: boolean;
  draw: PublicDraw | null;
}

/** Ordered entry references used as draw input, from GET /sessions/:id/draw/entries once the draw is done. */
export interface DrawEntriesList {
  entriesHash: string;
  references: string[];
}

export interface PaymentInfo {
  id: string;
  reference: string;
  sessionId: string;
  sessionName: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  failureReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  refundedAt: string | null;
  /** Until when a PENDING payment holds its place. */
  expiresAt: string | null;
  entryReference: string | null;
}

/** Returned by POST /sessions/:id/checkout. Send the user to redirectUrl to pay. */
export interface CheckoutResponse {
  payment: PaymentInfo;
  redirectUrl: string | null;
}

export interface EntryInfo {
  id: string;
  reference: string;
  sequence: number;
  status: EntryStatus;
  createdAt: string;
  paymentReference: string;
  session: { id: string; number: number; name: string; status: SessionStatus; drawScheduledAt: string | null };
  /** Prize position if this entry won, else null. */
  winningPosition: number | null;
}

/** Everything the signed-in user has bought, from GET /me/participations. */
export interface MyParticipations {
  entries: EntryInfo[];
  payments: PaymentInfo[];
}

/** One session row in the admin dashboard. */
export interface AdminSession extends PublicSession {
  updatedAt: string;
  createdByEmail: string;
  /** Payments started and still holding a place. */
  pendingPayments: number;
  /** Sum of succeeded, not refunded payments, in centimes. */
  revenueCents: number;
  drawLastError: string | null;
}

export interface AdminPayment extends PaymentInfo {
  userId: string;
  userEmail: string;
  providerTransactionId: string | null;
  idempotencyKey: string;
}

export interface AdminEntry {
  id: string;
  reference: string;
  sequence: number;
  status: EntryStatus;
  createdAt: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  paymentReference: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/** Counters for the top of the admin dashboard. */
export interface AdminStats {
  pendingVerifications: number;
  approvedUsers: number;
  openSessions: number;
  scheduledDraws: number;
  completedDraws: number;
  succeededPayments: number;
  revenueCents: number;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}
