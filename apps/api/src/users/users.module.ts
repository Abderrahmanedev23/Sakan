import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [MeController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class UsersModule {}
