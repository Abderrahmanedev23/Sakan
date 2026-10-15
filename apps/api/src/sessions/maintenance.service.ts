import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { DrawsService } from '../draws/draws.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TICK_MS = 60_000;

/**
 * Housekeeping that runs once a minute in the API process:
 * releases places held by abandoned payments, pauses sessions whose closing time passed
 * without filling (an admin then closes early or cancels), and re-queues draws that a
 * restart or a lost Redis job left behind. Uses only the database, so it costs no Redis commands.
 */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly draws: DrawsService,
  ) {}

  async onApplicationBootstrap() {
    await this.tick(true);
    this.timer = setInterval(() => void this.tick(false), TICK_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(startup: boolean) {
    if (this.running) return;
    this.running = true;
    try {
      await this.payments.expireStale();
      await this.pauseClosedSessions();
      await this.draws.recover(startup);
    } catch (err) {
      this.logger.error(`Maintenance failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  private async pauseClosedSessions() {
    const closed = await this.prisma.drawSession.findMany({
      where: { status: 'OPEN', closesAt: { lte: new Date() } },
      select: { id: true, confirmedEntries: true, targetEntries: true },
    });
    for (const session of closed) {
      const { count } = await this.prisma.drawSession.updateMany({
        where: { id: session.id, status: 'OPEN' },
        data: { status: 'PAUSED' },
      });
      if (count) {
        await this.audit.log({
          action: 'session.closing_time_reached',
          entityType: 'DrawSession',
          entityId: session.id,
          metadata: { confirmedEntries: session.confirmedEntries, targetEntries: session.targetEntries },
        });
      }
    }
  }
}
