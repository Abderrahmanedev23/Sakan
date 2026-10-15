import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DrawEntriesList, PublicSession } from '@sakan/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicSessionInclude, toPublicSession } from './session-view.js';

export type PublicSessionFilter = 'active' | 'completed' | 'all';

const FILTERS: Record<PublicSessionFilter, Prisma.DrawSessionWhereInput> = {
  active: { status: { in: ['OPEN', 'PAUSED', 'FULL', 'SCHEDULED'] } },
  completed: { status: 'COMPLETED' },
  all: { status: { not: 'DRAFT' } },
};

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active sessions first by draw date, completed ones newest draw first. Drafts are never public. */
  async listPublic(filter: PublicSessionFilter = 'all'): Promise<PublicSession[]> {
    const sessions = await this.prisma.drawSession.findMany({
      where: FILTERS[filter],
      orderBy: filter === 'completed' ? [{ drawScheduledAt: 'desc' }] : [{ createdAt: 'desc' }],
      include: publicSessionInclude,
      take: 100,
    });
    const now = new Date();
    return sessions.map((s) => toPublicSession(s, now));
  }

  async getPublic(id: string): Promise<PublicSession> {
    const session = await this.prisma.drawSession.findUnique({ where: { id }, include: publicSessionInclude });
    if (!session || session.status === 'DRAFT') throw new NotFoundException('Session not found');
    return toPublicSession(session);
  }

  /**
   * The ordered entry references the draw used, so anyone can recompute entriesHash and the
   * winner from the revealed seed. Published only once the draw is completed.
   */
  async drawEntries(id: string): Promise<DrawEntriesList> {
    const draw = await this.prisma.draw.findUnique({ where: { sessionId: id } });
    if (!draw || draw.status !== 'COMPLETED' || !draw.entriesHash || !draw.completedAt) {
      throw new ConflictException('The draw of this session has not taken place yet');
    }
    // Same selection as the draw itself: active entries in sequence order. Entries can't be
    // added or refunded once the draw has run, so this list is final.
    const entries = await this.prisma.entry.findMany({
      where: { sessionId: id, status: 'ACTIVE' },
      orderBy: { sequence: 'asc' },
      select: { reference: true },
    });
    return { entriesHash: draw.entriesHash, references: entries.map((e) => e.reference) };
  }
}
