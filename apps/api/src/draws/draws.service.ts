import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextDrawTime } from './draw-schedule.js';
import { generateSeed, hashEntries, pickWinnerIndexes } from './draw-selection.js';
import { DRAWS_QUEUE, RUN_DRAW_JOB, type RunDrawJobData } from './draws.constants.js';

@Injectable()
export class DrawsService {
  private readonly logger = new Logger(DrawsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue(DRAWS_QUEUE) private readonly queue: Queue<RunDrawJobData>,
  ) {}

  /** Moves a FULL session to SCHEDULED, commits to a seed and queues the draw job. */
  async scheduleDraw(sessionId: string) {
    const draw = await this.prisma.$transaction(async (tx) => {
      const session = await tx.drawSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Session not found');
      if (session.status !== 'FULL' || !session.filledAt) {
        throw new ConflictException(`Session is ${session.status}, expected FULL`);
      }

      const scheduledAt = nextDrawTime(session.filledAt, session.drawTimeOfDay, session.timezone);
      const { seed, seedHash } = generateSeed();

      const updated = await tx.drawSession.updateMany({
        where: { id: sessionId, status: 'FULL' },
        data: { status: 'SCHEDULED', drawScheduledAt: scheduledAt },
      });
      if (updated.count !== 1) throw new ConflictException('Session changed concurrently');

      const created = await tx.draw.create({ data: { sessionId, scheduledAt, seed, seedHash } });
      await this.audit.log(
        { action: 'draw.scheduled', entityType: 'DrawSession', entityId: sessionId, metadata: { scheduledAt: scheduledAt.toISOString(), seedHash } },
        tx,
      );
      return created;
    });

    await this.enqueue(sessionId, draw.scheduledAt);
    return draw;
  }

  /** Adds the delayed job. The fixed jobId makes this idempotent. */
  async enqueue(sessionId: string, scheduledAt: Date) {
    await this.queue.add(
      RUN_DRAW_JOB,
      { sessionId },
      {
        jobId: `draw-${sessionId}`,
        delay: Math.max(0, scheduledAt.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
      },
    );
  }

  /** Runs the draw. Safe to call more than once: only one call can claim a SCHEDULED draw. */
  async executeDraw(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await tx.draw.findUnique({ where: { sessionId }, include: { session: true } });
      if (!draw) throw new NotFoundException('No draw for session');
      if (draw.status === 'COMPLETED') {
        this.logger.warn(`Draw for session ${sessionId} already completed, skipping`);
        return draw;
      }
      if (draw.scheduledAt.getTime() > Date.now()) {
        throw new ConflictException('Draw time has not been reached');
      }

      const claimed = await tx.draw.updateMany({
        where: { id: draw.id, status: 'SCHEDULED' },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException(`Draw is ${draw.status}`);

      const entries = await tx.entry.findMany({
        where: { sessionId, status: 'ACTIVE' },
        orderBy: { sequence: 'asc' },
        select: { id: true, reference: true },
      });
      const entriesHash = hashEntries(entries.map((e) => e.reference));
      const indexes = pickWinnerIndexes(draw.seed!, entriesHash, entries.length, draw.session.winnerCount);

      await tx.drawWinner.createMany({
        data: indexes.map((index, i) => ({ drawId: draw.id, entryId: entries[index].id, position: i + 1 })),
      });
      const completed = await tx.draw.update({
        where: { id: draw.id },
        data: { status: 'COMPLETED', completedAt: new Date(), entriesHash, entryCount: entries.length },
      });
      await tx.drawSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } });
      await this.audit.log(
        {
          action: 'draw.completed',
          entityType: 'DrawSession',
          entityId: sessionId,
          metadata: { entriesHash, entryCount: entries.length, winners: indexes.map((i) => entries[i].reference) },
        },
        tx,
      );
      return completed;
    });
  }
}
