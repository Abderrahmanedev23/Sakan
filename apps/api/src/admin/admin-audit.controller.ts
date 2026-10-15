import { Controller, Get, Query } from '@nestjs/common';
import type { AuditLogEntry, Paginated } from '@sakan/shared';
import { z } from 'zod';
import { Roles } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const querySchema = z.object({
  entityType: z.string().max(50).optional(),
  entityId: z.uuid().optional(),
  /** Matches the start of the action, e.g. "payment." or "session.cancelled". */
  action: z.string().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Read-only view of the append-only audit log. */
@Controller('admin/audit-logs')
@Roles('ADMIN')
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(querySchema)) query: z.output<typeof querySchema>): Promise<Paginated<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType || undefined,
      entityId: query.entityId,
      action: query.action ? { startsWith: query.action } : undefined,
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { actor: { select: { email: true } } },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actorEmail: log.actor?.email ?? null,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
