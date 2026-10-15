import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DrawsModule } from './draws/draws.module.js';
import { HealthModule } from './health/health.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ needs a ready-made client under ESM; workers require maxRetriesPerRequest: null.
        connection: new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    UsersModule,
    AdminModule,
    HealthModule,
    SessionsModule,
    PaymentsModule,
    DrawsModule,
  ],
})
export class AppModule {}
