import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccountStatus,
  AdminUserDetail,
  AdminUserSummary,
  Paginated,
  VerificationStatus,
} from '@sakan/shared';
import type { Readable } from 'node:stream';
import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { toUserProfile, userProfileInclude } from '../users/user-profile.js';

export interface UserListQuery {
  verificationStatus?: VerificationStatus;
  accountStatus?: AccountStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** The pending queue is oldest submission first; every other list is newest account first. */
  async list(query: UserListQuery): Promise<Paginated<AdminUserSummary>> {
    const q = query.q?.trim();
    // Matching ignores case (and accents) through the tables' utf8mb4_unicode_ci collation.
    const where: Prisma.UserWhereInput = {
      verificationStatus: query.verificationStatus,
      accountStatus: query.accountStatus,
      OR: q
        ? [
            { email: { contains: q } },
            { cinNumber: { contains: q.replace(/[\s-]/g, '') } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
          ]
        : undefined,
    };
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.verificationStatus === 'PENDING'
        ? [{ identitySubmittedAt: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'asc' }];

    const users = await this.prisma.user.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = users.slice(0, query.limit);
    return {
      items: page.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        accountStatus: u.accountStatus,
        verificationStatus: u.verificationStatus,
        firstName: u.firstName,
        lastName: u.lastName,
        cinNumber: u.cinNumber,
        identitySubmittedAt: u.identitySubmittedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      nextCursor: users.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async detail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userProfileInclude });
    if (!user) throw new NotFoundException('User not found');
    const [reviews, auditLogs] = await Promise.all([
      this.prisma.verificationReview.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { email: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'User', entityId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { email: true } } },
      }),
    ]);
    return {
      user: toUserProfile(user),
      reviews: reviews.map((r) => ({
        id: r.id,
        decision: r.decision,
        reason: r.reason,
        reviewerEmail: r.reviewer.email,
        createdAt: r.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorEmail: log.actor?.email ?? null,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  approve(adminId: string, userId: string, ipAddress: string | null) {
    return this.decide(adminId, userId, 'APPROVED', null, ipAddress);
  }

  reject(adminId: string, userId: string, reason: string, ipAddress: string | null) {
    return this.decide(adminId, userId, 'REJECTED', reason, ipAddress);
  }

  /** Only a PENDING submission can be decided, and only once, even if two admins click at the same time. */
  private async decide(
    adminId: string,
    userId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string | null,
    ipAddress: string | null,
  ): Promise<AdminUserDetail> {
    if (adminId === userId) throw new ForbiddenException('You cannot review your own identity');
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, verificationStatus: 'PENDING' },
        data: { verificationStatus: decision, verifiedAt: decision === 'APPROVED' ? new Date() : null },
      });
      if (count === 0) {
        const exists = await tx.user.count({ where: { id: userId } });
        if (!exists) throw new NotFoundException('User not found');
        throw new ConflictException('This identity is not waiting for review');
      }
      await tx.verificationReview.create({ data: { userId, reviewerId: adminId, decision, reason } });
      await this.audit.log(
        {
          actorId: adminId,
          action: decision === 'APPROVED' ? 'identity.approved' : 'identity.rejected',
          entityType: 'User',
          entityId: userId,
          metadata: reason ? { reason } : undefined,
          ipAddress,
        },
        tx,
      );
    });
    return this.detail(userId);
  }

  /** Suspending blocks sign-in and ends every open session of the user straight away. */
  async setAccountStatus(
    adminId: string,
    userId: string,
    status: AccountStatus,
    reason: string | null,
    ipAddress: string | null,
  ): Promise<AdminUserDetail> {
    if (adminId === userId) throw new ForbiddenException('You cannot change your own account status');
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, accountStatus: status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' },
        data: { accountStatus: status },
      });
      if (count === 0) {
        const exists = await tx.user.count({ where: { id: userId } });
        if (!exists) throw new NotFoundException('User not found');
        throw new ConflictException(`This account is already ${status.toLowerCase()}`);
      }
      if (status === 'SUSPENDED') {
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.audit.log(
        {
          actorId: adminId,
          action: status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated',
          entityType: 'User',
          entityId: userId,
          metadata: reason ? { reason } : undefined,
          ipAddress,
        },
        tx,
      );
    });
    return this.detail(userId);
  }

  /** Streams a CIN scan to an admin. Every view is audited. */
  async openDocument(
    adminId: string,
    documentId: string,
    ipAddress: string | null,
  ): Promise<{ stream: Readable; mimeType: string; sizeBytes: number }> {
    const doc = await this.prisma.identityDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.audit.log({
      actorId: adminId,
      action: 'identity_document.viewed',
      entityType: 'User',
      entityId: doc.userId,
      metadata: { documentId: doc.id, side: doc.side },
      ipAddress,
    });
    return { stream: await this.storage.read(doc.storageKey), mimeType: doc.mimeType, sizeBytes: doc.sizeBytes };
  }
}
