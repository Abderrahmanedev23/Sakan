import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DRAWS_QUEUE, type RunDrawJobData } from './draws.constants.js';
import { DrawsService } from './draws.service.js';

// Draws are rare, so poll Redis slowly: hosted Redis free plans (Upstash) bill per command,
// and BullMQ's defaults (5 s long poll, 30 s stall check) would use more than the free monthly quota
// while idle. Delayed draw jobs still start on time because BullMQ wakes the poll for them.
@Processor(DRAWS_QUEUE, { drainDelay: 300, stalledInterval: 300_000 })
export class DrawsProcessor extends WorkerHost {
  private readonly logger = new Logger(DrawsProcessor.name);

  constructor(private readonly draws: DrawsService) {
    super();
  }

  async process(job: Job<RunDrawJobData>) {
    this.logger.log(`Running draw for session ${job.data.sessionId}`);
    try {
      await this.draws.executeDraw(job.data.sessionId);
    } catch (err) {
      this.logger.error(`Draw for session ${job.data.sessionId} failed: ${err}`);
      await this.draws.recordFailure(job.data.sessionId, err);
      throw err;
    }
  }
}
