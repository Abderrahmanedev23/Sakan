import { Controller, Get } from '@nestjs/common';
import type { PublicSession } from '@sakan/shared';
import { Public } from '../auth/auth.decorators.js';
import { SessionsService } from './sessions.service.js';

@Public()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(): Promise<PublicSession[]> {
    return this.sessions.listPublic();
  }
}
