import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { drawTimeFor } from './draw-schedule.js';
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

      const scheduledAt = drawTimeFor(session);
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
    this.logger.log(`Draw for session ${sessionId} scheduled at ${draw.scheduledAt.toISOString()}`);
    return draw;
  }

  /** Adds the delayed job. The fixed jobId makes this idempotent while the job exists. */
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
        removeOnFail: true,
      },
    );
  }

  /** Removes a queued draw job, e.g. when its session is cancelled. */
  async dequeue(sessionId: string) {
    await this.queue.remove(`draw-${sessionId}`).catch(() => undefined);
  }

  /**
   * Puts the scheduler back in a consistent state after a restart or a lost job:
   * schedules sessions left FULL without a draw, and re-queues draws whose time has
   * passed (all of them when `all` is set, as on startup).
   */
  async recover(all = false) {
    const full = await this.prisma.drawSession.findMany({ where: { status: 'FULL', draw: null }, select: { id: true } });
    for (const { id } of full) {
      await this.scheduleDraw(id).catch((err) => this.logger.error(`Could not schedule draw for ${id}: ${err}`));
    }
    const due = await this.prisma.draw.findMany({
      where: all ? { status: 'SCHEDULED' } : { status: 'SCHEDULED', lastError: null, scheduledAt: { lt: new Date(Date.now() - 60_000) } },
      select: { sessionId: true, scheduledAt: true },
    });
    for (const draw of due) await this.enqueue(draw.sessionId, draw.scheduledAt);
  }

  /** Marks the draw of a cancelled session. Call inside the cancelling transaction. */
  async cancelInTx(tx: Prisma.TransactionClient, sessionId: string) {
    await tx.draw.updateMany({ where: { sessionId, status: { in: ['SCHEDULED', 'FAILED'] } }, data: { status: 'CANCELLED' } });
  }

  /** Keeps the last error on the draw so admins see why it has not run. */
  async recordFailure(sessionId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await this.prisma.draw.updateMany({ where: { sessionId, status: 'SCHEDULED' }, data: { lastError: message.slice(0, 500) } });
  }

  /** Admin retry of a draw whose time has passed but which has not completed. */
  async retry(adminId: string, sessionId: string, ipAddress: string | null) {
    const draw = await this.prisma.draw.findUnique({ where: { sessionId } });
    if (!draw) throw new NotFoundException('This session has no draw');
    if (draw.status !== 'SCHEDULED') throw new ConflictException(`The draw is ${draw.status.toLowerCase()}`);
    if (draw.scheduledAt.getTime() > Date.now()) throw new ConflictException('The draw time has not been reached');
    await this.audit.log({ actorId: adminId, action: 'draw.retried', entityType: 'DrawSession', entityId: sessionId, ipAddress });
    await this.prisma.draw.update({ where: { id: draw.id }, data: { lastError: null } });
    try {
      return await this.executeDraw(sessionId);
    } catch (err) {
      await this.recordFailure(sessionId, err);
      throw err;
    }
  }

  /** Runs the draw. Safe to call more than once: only one call can claim a SCHEDULED draw. */
  async executeDraw(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await tx.draw.findUnique({ where: { sessionId }, include: { session: true } });
      if (!draw) throw new NotFoundException('No draw for session');
      if (draw.status === 'COMPLETED' || draw.status === 'CANCELLED') {
        this.logger.warn(`Draw for session ${sessionId} is ${draw.status}, skipping`);
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
      const winnerCount = Math.min(draw.session.winnerCount, entries.length);
      const indexes = pickWinnerIndexes(draw.seed!, entriesHash, entries.length, winnerCount);

      await tx.drawWinner.createMany({
        data: indexes.map((index, i) => ({ drawId: draw.id, entryId: entries[index].id, position: i + 1 })),
      });
      const completed = await tx.draw.update({
        where: { id: draw.id },
        data: { status: 'COMPLETED', completedAt: new Date(), entriesHash, entryCount: entries.length, lastError: null },
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
      this.logger.log(`Draw for session ${sessionId} completed with ${entries.length} entries`);
      return completed;
    });
  }
}
