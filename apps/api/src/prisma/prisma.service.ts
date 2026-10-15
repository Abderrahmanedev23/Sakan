import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { prismaOptions } from './database.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super(prismaOptions(config.getOrThrow<string>('DATABASE_URL')));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
