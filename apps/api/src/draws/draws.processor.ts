import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DRAWS_QUEUE, type RunDrawJobData } from './draws.constants.js';
import { DrawsService } from './draws.service.js';

@Processor(DRAWS_QUEUE)
export class DrawsProcessor extends WorkerHost {
  private readonly logger = new Logger(DrawsProcessor.name);

  constructor(private readonly draws: DrawsService) {
    super();
  }

  async process(job: Job<RunDrawJobData>) {
    this.logger.log(`Running draw for session ${job.data.sessionId}`);
    await this.draws.executeDraw(job.data.sessionId);
  }
}
