import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DRAWS_QUEUE } from './draws.constants.js';
import { DrawsProcessor } from './draws.processor.js';
import { DrawsService } from './draws.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: DRAWS_QUEUE })],
  providers: [DrawsService, DrawsProcessor],
  exports: [DrawsService],
})
export class DrawsModule {}
