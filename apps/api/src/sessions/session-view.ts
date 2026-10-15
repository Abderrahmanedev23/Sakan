import type { AdminSession, PaymentInfo, PublicDraw, PublicSession } from '@sakan/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Prisma include that loads the draw and its winners for toPublicSession. */
export const publicSessionInclude = {
  draw: {
    include: {
      winners: {
        orderBy: { position: 'asc' },
        include: { entry: { select: { reference: true, user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  },
} satisfies Prisma.DrawSessionInclude;

export type SessionWithDraw = Prisma.DrawSessionGetPayload<{ include: typeof publicSessionInclude }>;
type SessionRow = Prisma.DrawSessionGetPayload<object>;

/** "Youssef Alaoui" → "Youssef A.": enough to recognise yourself, not enough to identify a stranger. */
export function maskName(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim() || '—';
  const initial = lastName?.trim()?.[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/**
 * Whether the session takes new entries at `now`. With allowOverfill, entries keep coming
 * after the target until a minute before the draw.
 */
export function isAcceptingEntries(session: SessionRow, now = new Date()): boolean {
  if (session.opensAt && session.opensAt > now) return false;
  if (session.closesAt && session.closesAt <= now) return false;
  if (session.status === 'OPEN') return session.allowOverfill || session.confirmedEntries < session.targetEntries;
  if (session.allowOverfill && (session.status === 'FULL' || session.status === 'SCHEDULED')) {
    return !session.drawScheduledAt || session.drawScheduledAt.getTime() - now.getTime() > 60_000;
  }
  return false;
}

function toPublicDraw(draw: NonNullable<SessionWithDraw['draw']>): PublicDraw {
  const done = draw.status === 'COMPLETED';
  return {
    status: draw.status,
    scheduledAt: draw.scheduledAt.toISOString(),
    seedHash: draw.seedHash,
    // Commit-reveal: the seed is only published once the result is final.
    seed: done ? draw.seed : null,
    entriesHash: draw.entriesHash,
    entryCount: draw.entryCount,
    completedAt: draw.completedAt?.toISOString() ?? null,
    winners: draw.winners.map((w) => ({
      position: w.position,
      entryReference: w.entry.reference,
      displayName: maskName(w.entry.user.firstName, w.entry.user.lastName),
    })),
  };
}

export function toPublicSession(s: SessionWithDraw, now = new Date()): PublicSession {
  return {
    id: s.id,
    number: s.number,
    name: s.name,
    description: s.description,
    status: s.status,
    entryPriceCents: s.entryPriceCents,
    currency: s.currency,
    targetEntries: s.targetEntries,
    confirmedEntries: s.confirmedEntries,
    winnerCount: s.winnerCount,
    maxEntriesPerUser: s.maxEntriesPerUser,
    allowOverfill: s.allowOverfill,
    drawTimeOfDay: s.drawTimeOfDay,
    timezone: s.timezone,
    drawDelayMinutes: s.drawDelayMinutes,
    opensAt: s.opensAt?.toISOString() ?? null,
    closesAt: s.closesAt?.toISOString() ?? null,
    filledAt: s.filledAt?.toISOString() ?? null,
    drawScheduledAt: s.drawScheduledAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    acceptingEntries: isAcceptingEntries(s, now),
    draw: s.draw ? toPublicDraw(s.draw) : null,
  };
}

export const adminSessionInclude = {
  ...publicSessionInclude,
  createdBy: { select: { email: true } },
} satisfies Prisma.DrawSessionInclude;

export type AdminSessionRow = Prisma.DrawSessionGetPayload<{ include: typeof adminSessionInclude }>;

export function toAdminSession(
  s: AdminSessionRow,
  extra: { pendingPayments: number; revenueCents: number },
): AdminSession {
  return {
    ...toPublicSession(s),
    // Admins see the seed hash and status but never the unrevealed seed.
    updatedAt: s.updatedAt.toISOString(),
    createdByEmail: s.createdBy.email,
    pendingPayments: extra.pendingPayments,
    revenueCents: extra.revenueCents,
    drawLastError: s.draw?.lastError ?? null,
  };
}

export const paymentInfoInclude = {
  session: { select: { name: true } },
  entry: { select: { reference: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInfoInclude }>;

export function toPaymentInfo(p: PaymentRow): PaymentInfo {
  return {
    id: p.id,
    reference: p.reference,
    sessionId: p.sessionId,
    sessionName: p.session.name,
    amountCents: p.amountCents,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    confirmedAt: p.confirmedAt?.toISOString() ?? null,
    refundedAt: p.refundedAt?.toISOString() ?? null,
    expiresAt: p.status === 'PENDING' ? (p.expiresAt?.toISOString() ?? null) : null,
    entryReference: p.entry?.reference ?? null,
  };
}
