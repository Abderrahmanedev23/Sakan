import { Controller, Get } from '@nestjs/common';
import type { PublicSession } from '@sakan/shared';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(): Promise<PublicSession[]> {
    return this.sessions.listPublic();
  }
}
