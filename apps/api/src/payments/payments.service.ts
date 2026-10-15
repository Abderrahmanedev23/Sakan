import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  formatEntryReference,
  PAYMENT_HOLD_MINUTES,
  type AdminPayment,
  type CheckoutResponse,
  type MyParticipations,
  type Paginated,
  type PaymentInfo,
  type PaymentStatus,
} from '@sakan/shared';
import { AuditService } from '../audit/audit.service.js';
import { lockSession } from '../common/locks.js';
import { DrawsService } from '../draws/draws.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isAcceptingEntries, paymentInfoInclude, toPaymentInfo } from '../sessions/session-view.js';
import { PAYMENT_PROVIDER, type PaymentProvider, type VerifiedCallback } from './payment-provider.js';
import { StubPaymentProvider } from './stub-payment.provider.js';

/** Failure reason given to PENDING payments whose hold ran out. A late success callback can still revive them. */
export const EXPIRED_REASON = 'Expired before payment was completed';

export interface AdminPaymentQuery {
  status?: PaymentStatus;
  sessionId?: string;
  q?: string;
  cursor?: string;
  limit: number;
}

/** Crockford-style alphabet without look-alike characters, for references people read out loud. */
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function paymentReference(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (const b of bytes) out += REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length];
  return `PAY-${out}`;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly draws: DrawsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    config: ConfigService,
  ) {
    // Falls back to the first allowed CORS origin, which is the web app in every deployment so far.
    const webUrl = config.get<string>('WEB_URL') || config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',')[0];
    this.webUrl = webUrl.trim().replace(/\/$/, '');
  }

  /**
   * Starts paying for one entry. Only approved users can buy, a place is held for
   * PAYMENT_HOLD_MINUTES so the target is never oversold, and retrying with the same
   * idempotency key returns the same payment instead of creating another.
   */
  async checkout(userId: string, sessionId: string, idempotencyKey: string, ipAddress: string | null): Promise<CheckoutResponse> {
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey }, include: paymentInfoInclude });
    if (existing) return this.replay(existing, userId, sessionId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException('Your identity must be verified before you can take part');
    }

    let payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        await lockSession(tx, sessionId);
        const session = await tx.drawSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new NotFoundException('Session not found');
        const now = new Date();
        if (!isAcceptingEntries(session, now)) throw new ConflictException('This session is not accepting entries');

        const held = await tx.payment.count({ where: { sessionId, status: 'PENDING', expiresAt: { gt: now } } });
        if (!session.allowOverfill && session.confirmedEntries + held >= session.targetEntries) {
          throw new ConflictException('All remaining places are being paid for. Try again in a few minutes.');
        }
        if (session.maxEntriesPerUser) {
          const mine = await tx.payment.count({
            where: {
              sessionId,
              userId,
              OR: [{ status: 'SUCCEEDED' }, { status: 'PENDING', expiresAt: { gt: now } }],
            },
          });
          if (mine >= session.maxEntriesPerUser) {
            throw new ConflictException(`You can have at most ${session.maxEntriesPerUser} entries in this session`);
          }
        }

        const created = await tx.payment.create({
          data: {
            reference: paymentReference(),
            userId,
            sessionId,
            amountCents: session.entryPriceCents,
            currency: session.currency,
            provider: this.provider.name,
            idempotencyKey,
            expiresAt: new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000),
          },
        });
        await this.audit.log(
          {
            actorId: userId,
            action: 'payment.created',
            entityType: 'Payment',
            entityId: created.id,
            metadata: { reference: created.reference, sessionId, amountCents: created.amountCents },
            ipAddress,
          },
          tx,
        );
        return created;
      });
    } catch (err) {
      // Two requests with the same key at the same time: the loser returns the winner's payment.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.payment.findUnique({ where: { idempotencyKey }, include: paymentInfoInclude });
        if (raced) return this.replay(raced, userId, sessionId);
      }
      throw err;
    }

    try {
      const checkout = await this.provider.createCheckout({
        paymentReference: payment.reference,
        amountCents: payment.amountCents,
        currency: payment.currency,
        customerEmail: user.email,
        returnUrl: `${this.webUrl}/payments/${payment.reference}`,
      });
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerTransactionId: checkout.providerTransactionId, checkoutUrl: checkout.redirectUrl },
        include: paymentInfoInclude,
      });
      return { payment: toPaymentInfo(updated), redirectUrl: checkout.redirectUrl };
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: 'Could not start the payment' },
      });
      this.logger.error(`Checkout failed for ${payment.reference}: ${err}`);
      throw new ConflictException('The payment could not be started. Try again.');
    }
  }

  private replay(
    payment: Prisma.PaymentGetPayload<{ include: typeof paymentInfoInclude }>,
    userId: string,
    sessionId: string,
  ): CheckoutResponse {
    if (payment.userId !== userId || payment.sessionId !== sessionId) {
      throw new ConflictException('This idempotency key was already used for another request');
    }
    return { payment: toPaymentInfo(payment), redirectUrl: payment.status === 'PENDING' ? payment.checkoutUrl : null };
  }

  async getForUser(userId: string, reference: string): Promise<PaymentInfo> {
    const payment = await this.prisma.payment.findUnique({ where: { reference }, include: paymentInfoInclude });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    return toPaymentInfo(payment);
  }

  /** Development only: the payer confirms or declines a stub payment from the simulated checkout page. */
  async completeStub(userId: string, reference: string, succeeded: boolean): Promise<PaymentInfo> {
    if (!(this.provider instanceof StubPaymentProvider)) throw new NotFoundException('Simulated payments are disabled');
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    if (payment.provider !== 'stub' || !payment.providerTransactionId) throw new BadRequestException('Not a simulated payment');
    const body = { paymentReference: reference, providerTransactionId: payment.providerTransactionId, succeeded };
    // Go through signature verification exactly like a provider webhook would.
    const verified = await this.provider.verifyCallback({ 'x-stub-signature': this.provider.sign(body) }, body);
    await this.confirm(verified);
    return this.getForUser(userId, reference);
  }

  /** Provider webhook: verifies the signature, then records the outcome. */
  async handleCallback(providerName: string, headers: Record<string, string | string[] | undefined>, body: unknown) {
    if (providerName !== this.provider.name) throw new NotFoundException('Unknown payment provider');
    const verified = await this.provider.verifyCallback(headers, body);
    await this.confirm(verified);
    return { received: true };
  }

  /**
   * Records a verified provider outcome exactly once. A success creates the entry and may
   * fill the session; if the session can no longer take it (cancelled, closed, full), the
   * payment is refunded instead so nobody pays without an entry.
   */
  async confirm(cb: VerifiedCallback): Promise<void> {
    const found = await this.prisma.payment.findUnique({ where: { reference: cb.paymentReference } });
    if (!found) throw new NotFoundException('Payment not found');

    let filled = false;
    let refund: { providerTransactionId: string; amountCents: number } | null = null;

    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, found.sessionId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });
      if (payment.providerTransactionId && payment.providerTransactionId !== cb.providerTransactionId) {
        throw new BadRequestException('Transaction does not match this payment');
      }
      const revivable = payment.status === 'FAILED' && payment.failureReason === EXPIRED_REASON && cb.succeeded;
      if (payment.status !== 'PENDING' && !revivable) {
        // Already processed: callbacks are retried by providers, so this is normal.
        this.logger.log(`Payment ${payment.reference} already ${payment.status}, ignoring callback`);
        return;
      }
      const payload = cb.rawPayload as Prisma.InputJsonValue;
      const base = { providerTransactionId: cb.providerTransactionId, providerPayload: payload };

      if (!cb.succeeded) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { ...base, status: 'FAILED', failureReason: cb.failureReason ?? 'Declined' },
        });
        await this.audit.log(
          { actorId: payment.userId, action: 'payment.failed', entityType: 'Payment', entityId: payment.id, metadata: { reference: payment.reference, reason: cb.failureReason ?? null } },
          tx,
        );
        return;
      }

      const session = await tx.drawSession.findUniqueOrThrow({ where: { id: payment.sessionId } });
      const now = new Date();
      const statusTakesEntries =
        session.status === 'OPEN' ||
        session.status === 'PAUSED' ||
        (session.allowOverfill && isAcceptingEntries(session, now));
      const hasRoom = session.allowOverfill || session.confirmedEntries < session.targetEntries;
      if (!statusTakesEntries || !hasRoom) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            ...base,
            status: 'REFUNDED',
            confirmedAt: now,
            refundedAt: now,
            failureReason: 'The session could no longer accept this entry, so the payment was refunded',
          },
        });
        await this.audit.log(
          { action: 'payment.auto_refunded', entityType: 'Payment', entityId: payment.id, metadata: { reference: payment.reference, sessionStatus: session.status } },
          tx,
        );
        refund = { providerTransactionId: cb.providerTransactionId, amountCents: payment.amountCents };
        return;
      }

      const last = await tx.entry.aggregate({ where: { sessionId: session.id }, _max: { sequence: true } });
      const sequence = (last._max.sequence ?? 0) + 1;
      await tx.payment.update({
        where: { id: payment.id },
        data: { ...base, status: 'SUCCEEDED', confirmedAt: now, failureReason: null },
      });
      const entry = await tx.entry.create({
        data: {
          reference: formatEntryReference(session.number, sequence),
          sessionId: session.id,
          userId: payment.userId,
          paymentId: payment.id,
          sequence,
        },
      });
      const confirmedEntries = session.confirmedEntries + 1;
      const reachesTarget = confirmedEntries >= session.targetEntries && (session.status === 'OPEN' || session.status === 'PAUSED');
      await tx.drawSession.update({
        where: { id: session.id },
        data: { confirmedEntries, ...(reachesTarget ? { status: 'FULL', filledAt: now } : {}) },
      });
      await this.audit.log(
        {
          actorId: payment.userId,
          action: 'payment.succeeded',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: { reference: payment.reference, entryReference: entry.reference, sessionId: session.id },
        },
        tx,
      );
      if (reachesTarget) {
        await this.audit.log(
          { action: 'session.filled', entityType: 'DrawSession', entityId: session.id, metadata: { confirmedEntries } },
          tx,
        );
        filled = true;
      }
    });

    if (refund) await this.refundAtProvider(refund);
    if (filled) await this.draws.scheduleDraw(found.sessionId);
  }

  /** Releases places held by payments that were never completed. */
  async expireStale(): Promise<number> {
    const { count } = await this.prisma.payment.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'FAILED', failureReason: EXPIRED_REASON },
    });
    if (count) this.logger.log(`Expired ${count} unfinished payment(s)`);
    return count;
  }

  /**
   * Admin correction: refunds one succeeded payment and voids its entry. Only while the
   * session is still collecting entries, so a scheduled or completed draw never changes.
   */
  async refundByAdmin(adminId: string, paymentId: string, reason: string, ipAddress: string | null): Promise<AdminPayment> {
    const found = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!found) throw new NotFoundException('Payment not found');
    const refund = await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, found.sessionId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { entry: true, session: true } });
      if (payment.status !== 'SUCCEEDED') throw new ConflictException(`Only succeeded payments can be refunded (this one is ${payment.status.toLowerCase()})`);
      if (payment.session.status !== 'OPEN' && payment.session.status !== 'PAUSED') {
        throw new ConflictException('Entries can only be refunded while the session is open or paused');
      }
      const now = new Date();
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED', refundedAt: now, failureReason: reason } });
      if (payment.entry?.status === 'ACTIVE') {
        await tx.entry.update({ where: { id: payment.entry.id }, data: { status: 'VOID' } });
        await tx.drawSession.update({ where: { id: payment.sessionId }, data: { confirmedEntries: { decrement: 1 } } });
      }
      await this.audit.log(
        {
          actorId: adminId,
          action: 'payment.refunded',
          entityType: 'Payment',
          entityId: paymentId,
          metadata: { reference: payment.reference, entryReference: payment.entry?.reference ?? null, reason },
          ipAddress,
        },
        tx,
      );
      return { providerTransactionId: payment.providerTransactionId, amountCents: payment.amountCents };
    });
    await this.refundAtProvider(refund);
    return this.adminGet(paymentId);
  }

  /** Asks the provider to return the money. A failure is logged and audited for a manual follow-up. */
  async refundAtProvider(refund: { providerTransactionId: string | null; amountCents: number }) {
    if (!refund.providerTransactionId) return;
    try {
      await this.provider.refund(refund.providerTransactionId, refund.amountCents);
    } catch (err) {
      this.logger.error(`Refund of ${refund.providerTransactionId} failed: ${err}`);
      await this.audit.log({
        action: 'payment.refund_failed',
        entityType: 'Payment',
        metadata: { providerTransactionId: refund.providerTransactionId, error: String(err) },
      });
    }
  }

  async myParticipations(userId: string): Promise<MyParticipations> {
    const [entries, payments] = await Promise.all([
      this.prisma.entry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          payment: { select: { reference: true } },
          session: { select: { id: true, number: true, name: true, status: true, drawScheduledAt: true } },
          wins: { select: { position: true } },
        },
      }),
      this.prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: paymentInfoInclude }),
    ]);
    return {
      entries: entries.map((e) => ({
        id: e.id,
        reference: e.reference,
        sequence: e.sequence,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        paymentReference: e.payment.reference,
        session: { ...e.session, drawScheduledAt: e.session.drawScheduledAt?.toISOString() ?? null },
        winningPosition: e.wins[0]?.position ?? null,
      })),
      payments: payments.map(toPaymentInfo),
    };
  }

  private static adminInclude = { ...paymentInfoInclude, user: { select: { email: true } } } satisfies Prisma.PaymentInclude;

  private static toAdmin(p: Prisma.PaymentGetPayload<{ include: typeof PaymentsService.adminInclude }>): AdminPayment {
    return {
      ...toPaymentInfo(p),
      userId: p.userId,
      userEmail: p.user.email,
      providerTransactionId: p.providerTransactionId,
      idempotencyKey: p.idempotencyKey,
    };
  }

  async adminGet(paymentId: string): Promise<AdminPayment> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: PaymentsService.adminInclude });
    if (!p) throw new NotFoundException('Payment not found');
    return PaymentsService.toAdmin(p);
  }

  async adminList(query: AdminPaymentQuery): Promise<Paginated<AdminPayment>> {
    const q = query.q?.trim();
    const where: Prisma.PaymentWhereInput = {
      status: query.status,
      sessionId: query.sessionId,
      OR: q
        ? [
            { reference: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { entry: { reference: { contains: q, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: PaymentsService.adminInclude,
    });
    const page = rows.slice(0, query.limit);
    return { items: page.map(PaymentsService.toAdmin), nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null };
  }
}
