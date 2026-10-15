import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { DrawEntriesList, PublicSession } from '@sakan/shared';
import { z } from 'zod';
import { Public } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SessionsService } from './sessions.service.js';

const listQuerySchema = z.object({ status: z.enum(['active', 'completed', 'all']).default('all') });

@Public()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** ?status=active (open to scheduled), completed, or all (default). Drafts are never listed. */
  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.output<typeof listQuerySchema>): Promise<PublicSession[]> {
    return this.sessions.listPublic(query.status);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PublicSession> {
    return this.sessions.getPublic(id);
  }

  /** Ordered entry references used by the completed draw, to verify the result independently. */
  @Get(':id/draw/entries')
  drawEntries(@Param('id', ParseUUIDPipe) id: string): Promise<DrawEntriesList> {
    return this.sessions.drawEntries(id);
  }
}
