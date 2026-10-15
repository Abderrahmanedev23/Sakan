import { Injectable } from '@nestjs/common';
import type { PublicSession } from '@sakan/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<PublicSession[]> {
    const sessions = await this.prisma.drawSession.findMany({
      where: { status: { notIn: ['DRAFT'] } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      status: s.status,
      entryPriceCents: s.entryPriceCents,
      currency: s.currency,
      targetEntries: s.targetEntries,
      confirmedEntries: s.confirmedEntries,
      drawScheduledAt: s.drawScheduledAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
