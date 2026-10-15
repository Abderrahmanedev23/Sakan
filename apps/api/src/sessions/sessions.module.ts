import { Module } from '@nestjs/common';
import { DrawsModule } from '../draws/draws.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminSessionsController } from './admin-sessions.controller.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { MaintenanceService } from './maintenance.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [DrawsModule, PaymentsModule],
  controllers: [SessionsController, AdminSessionsController],
  providers: [SessionsService, AdminSessionsService, MaintenanceService],
  exports: [SessionsService],
})
export class SessionsModule {}
