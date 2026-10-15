import { Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  controllers: [AdminUsersController, AdminAuditController],
  providers: [AdminUsersService],
})
export class AdminModule {}
