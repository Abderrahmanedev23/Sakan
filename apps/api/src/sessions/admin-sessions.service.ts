import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canTransition,
  type AdminEntry,
  type AdminSession,
  type AdminStats,
  type createSessionSchema,
  type Paginated,
  type SessionStatus,
  type updateSessionSchema,
} from '@sakan/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { lockSession } from '../common/locks.js';
import { DrawsService } from '../draws/draws.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { adminSessionInclude, toAdminSession } from './session-view.js';

type CreateInput = z.output<typeof createSessionSchema>;
type UpdateInput = z.output<typeof updateSessionSchema>;

/** Fields that only change while a session is a draft; afterwards they are part of the published rules. */
const DRAFT_ONLY_FIELDS = [
  'entryPriceCents',
  'targetEntries',
  'winnerCount',
  'maxEntriesPerUser',
  'allowOverfill',
  'drawTimeOfDay',
  'timezone',
  'drawDelayMinutes',
  'opensAt',
] as const;

export interface EntryListQuery {
  cursor?: string;
  q?: string;
  limit: number;
}

@Injectable()
export class AdminSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly draws: DrawsService,
    private readonly payments: PaymentsService,
  ) {}

  async stats(): Promise<AdminStats> {
    const [pendingVerifications, approvedUsers, openSessions, scheduledDraws, completedDraws, revenue] = await Promise.all([
      this.prisma.user.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.user.count({ where: { verificationStatus: 'APPROVED' } }),
      this.prisma.drawSession.count({ where: { status: { in: ['OPEN', 'PAUSED'] } } }),
      this.prisma.draw.count({ where: { status: { in: ['SCHEDULED', 'RUNNING'] } } }),
      this.prisma.draw.count({ where: { status: 'COMPLETED' } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountCents: true }, _count: true }),
    ]);
    return {
      pendingVerifications,
      approvedUsers,
      openSessions,
      scheduledDraws,
      completedDraws,
      succeededPayments: revenue._count,
      revenueCents: revenue._sum.amountCents ?? 0,
    };
  }

  async list(status?: SessionStatus): Promise<AdminSession[]> {
    const sessions = await this.prisma.drawSession.findMany({
      where: { status },
      orderBy: [{ createdAt: 'desc' }],
      include: adminSessionInclude,
    });
    return Promise.all(sessions.map((s) => this.withCounters(s)));
  }

  async get(id: string): Promise<AdminSession> {
    const session = await this.prisma.drawSession.findUnique({ where: { id }, include: adminSessionInclude });
    if (!session) throw new NotFoundException('Session not found');
    return this.withCounters(session);
  }

  private async withCounters(session: Prisma.DrawSessionGetPayload<{ include: typeof adminSessionInclude }>) {
    const [pendingPayments, revenue] = await Promise.all([
      this.prisma.payment.count({ where: { sessionId: session.id, status: 'PENDING', expiresAt: { gt: new Date() } } }),
      this.prisma.payment.aggregate({ where: { sessionId: session.id, status: 'SUCCEEDED' }, _sum: { amountCents: true } }),
    ]);
    return toAdminSession(session, { pendingPayments, revenueCents: revenue._sum.amountCents ?? 0 });
  }

  async create(adminId: string, input: CreateInput, ipAddress: string | null): Promise<AdminSession> {
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.drawSession.create({
        data: {
          name: input.name,
          description: input.description,
          entryPriceCents: input.entryPriceCents,
          targetEntries: input.targetEntries,
          winnerCount: input.winnerCount,
          maxEntriesPerUser: input.maxEntriesPerUser,
          allowOverfill: input.allowOverfill,
          drawTimeOfDay: input.drawTimeOfDay,
          timezone: input.timezone,
          drawDelayMinutes: input.drawDelayMinutes,
          opensAt: input.opensAt ?? null,
          closesAt: input.closesAt ?? null,
          createdById: adminId,
        },
      });
      await this.audit.log(
        { actorId: adminId, action: 'session.created', entityType: 'DrawSession', entityId: created.id, metadata: auditable(input), ipAddress },
        tx,
      );
      return created;
    });
    return this.get(session.id);
  }

  async update(adminId: string, id: string, input: UpdateInput, ipAddress: string | null): Promise<AdminSession> {
    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const session = await tx.drawSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException('Session not found');
      if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
        throw new ConflictException('A finished session can no longer be edited');
      }
      if (session.status !== 'DRAFT') {
        const locked = DRAFT_ONLY_FIELDS.filter((field) => input[field] !== undefined);
        if (locked.length) {
          throw new ConflictException(`Once a session is open only its name, description and closing time can change (not ${locked.join(', ')})`);
        }
      }
      const winnerCount = input.winnerCount ?? session.winnerCount;
      const targetEntries = input.targetEntries ?? session.targetEntries;
      if (winnerCount > targetEntries) throw new BadRequestException('More winners than entries');
      const opensAt = input.opensAt === undefined ? session.opensAt : input.opensAt;
      const closesAt = input.closesAt === undefined ? session.closesAt : input.closesAt;
      if (opensAt && closesAt && closesAt <= opensAt) throw new BadRequestException('The closing time must be after the opening time');

      await tx.drawSession.update({ where: { id }, data: input });
      await this.audit.log(
        { actorId: adminId, action: 'session.updated', entityType: 'DrawSession', entityId: id, metadata: auditable(input), ipAddress },
        tx,
      );
    });
    return this.get(id);
  }

  /** open, pause, resume: plain status changes guarded by SESSION_TRANSITIONS. */
  async setStatus(adminId: string, id: string, to: 'OPEN' | 'PAUSED', ipAddress: string | null): Promise<AdminSession> {
    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const session = await tx.drawSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException('Session not found');
      if (!canTransition(session.status, to)) {
        throw new ConflictException(`A ${session.status.toLowerCase()} session cannot become ${to.toLowerCase()}`);
      }
      await tx.drawSession.update({ where: { id }, data: { status: to } });
      const action = to === 'PAUSED' ? 'session.paused' : session.status === 'DRAFT' ? 'session.opened' : 'session.resumed';
      await this.audit.log({ actorId: adminId, action, entityType: 'DrawSession', entityId: id, ipAddress }, tx);
    });
    return this.get(id);
  }

  /**
   * Stops sales before the target is reached and schedules the draw with the entries so far,
   * under the session's normal draw time rule.
   */
  async closeEarly(adminId: string, id: string, ipAddress: string | null): Promise<AdminSession> {
    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const session = await tx.drawSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException('Session not found');
      if (!canTransition(session.status, 'FULL')) {
        throw new ConflictException(`A ${session.status.toLowerCase()} session cannot be closed`);
      }
      if (session.confirmedEntries < session.winnerCount) {
        throw new ConflictException(`At least ${session.winnerCount} paid entries are needed to draw`);
      }
      await tx.drawSession.update({ where: { id }, data: { status: 'FULL', filledAt: new Date() } });
      await this.audit.log(
        { actorId: adminId, action: 'session.closed_early', entityType: 'DrawSession', entityId: id, metadata: { confirmedEntries: session.confirmedEntries }, ipAddress },
        tx,
      );
    });
    await this.draws.scheduleDraw(id);
    return this.get(id);
  }

  /** Cancels the session and its draw, refunds every paid entry and releases unfinished payments. */
  async cancel(adminId: string, id: string, reason: string, ipAddress: string | null): Promise<AdminSession> {
    const refunds = await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, id);
      const session = await tx.drawSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException('Session not found');
      if (!canTransition(session.status, 'CANCELLED')) {
        throw new ConflictException(`A ${session.status.toLowerCase()} session cannot be cancelled`);
      }
      const now = new Date();
      const paid = await tx.payment.findMany({
        where: { sessionId: id, status: 'SUCCEEDED' },
        select: { id: true, providerTransactionId: true, amountCents: true },
      });
      await tx.payment.updateMany({
        where: { sessionId: id, status: 'SUCCEEDED' },
        data: { status: 'REFUNDED', refundedAt: now, failureReason: `Session cancelled: ${reason}` },
      });
      await tx.payment.updateMany({
        where: { sessionId: id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: 'Session cancelled' },
      });
      await tx.entry.updateMany({ where: { sessionId: id, status: 'ACTIVE' }, data: { status: 'VOID' } });
      await tx.drawSession.update({ where: { id }, data: { status: 'CANCELLED', confirmedEntries: 0 } });
      await this.draws.cancelInTx(tx, id);
      await this.audit.log(
        {
          actorId: adminId,
          action: 'session.cancelled',
          entityType: 'DrawSession',
          entityId: id,
          metadata: { reason, refundedPayments: paid.length, previousStatus: session.status },
          ipAddress,
        },
        tx,
      );
      return paid;
    });
    await this.draws.dequeue(id);
    for (const refund of refunds) await this.payments.refundAtProvider(refund);
    return this.get(id);
  }

  async entries(id: string, query: EntryListQuery): Promise<Paginated<AdminEntry>> {
    const q = query.q?.trim();
    const rows = await this.prisma.entry.findMany({
      where: {
        sessionId: id,
        OR: q
          ? [
              { reference: { contains: q } },
              { user: { email: { contains: q } } },
              { user: { cinNumber: { contains: q } } },
            ]
          : undefined,
      },
      orderBy: [{ sequence: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        payment: { select: { reference: true } },
      },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((e) => ({
        id: e.id,
        reference: e.reference,
        sequence: e.sequence,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        userId: e.userId,
        userEmail: e.user.email,
        userName: e.user.firstName || e.user.lastName ? `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim() : null,
        paymentReference: e.payment.reference,
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  retryDraw(adminId: string, id: string, ipAddress: string | null) {
    return this.draws.retry(adminId, id, ipAddress).then(() => this.get(id));
  }
}

/** Session input as JSON for the audit log (dates as ISO strings). */
function auditable(input: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}
