import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  createSessionSchema,
  reasonSchema,
  SessionStatus,
  updateSessionSchema,
  type AdminEntry,
  type AdminSession,
  type AdminStats,
  type Paginated,
} from '@sakan/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { requestMeta } from '../common/request-meta.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminSessionsService, type EntryListQuery } from './admin-sessions.service.js';

const listQuerySchema = z.object({ status: z.enum(Object.values(SessionStatus)).optional() });
const entriesQuerySchema = z.object({
  q: z.string().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Controller('admin')
@Roles('ADMIN')
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.sessions.stats();
  }

  @Get('sessions')
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.output<typeof listQuerySchema>): Promise<AdminSession[]> {
    return this.sessions.list(query.status);
  }

  /** Creates a DRAFT session. Open it with POST /admin/sessions/:id/open. */
  @Post('sessions')
  create(
    @CurrentUser() admin: AuthUser,
    @Body(new ZodValidationPipe(createSessionSchema)) body: z.output<typeof createSessionSchema>,
    @Req() req: Request,
  ): Promise<AdminSession> {
    return this.sessions.create(admin.id, body, requestMeta(req).ipAddress);
  }

  @Get('sessions/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminSession> {
    return this.sessions.get(id);
  }

  @Patch('sessions/:id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: z.output<typeof updateSessionSchema>,
    @Req() req: Request,
  ): Promise<AdminSession> {
    return this.sessions.update(admin.id, id, body, requestMeta(req).ipAddress);
  }

  @Post('sessions/:id/open')
  @HttpCode(200)
  open(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sessions.setStatus(admin.id, id, 'OPEN', requestMeta(req).ipAddress);
  }

  @Post('sessions/:id/pause')
  @HttpCode(200)
  pause(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sessions.setStatus(admin.id, id, 'PAUSED', requestMeta(req).ipAddress);
  }

  @Post('sessions/:id/resume')
  @HttpCode(200)
  resume(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sessions.setStatus(admin.id, id, 'OPEN', requestMeta(req).ipAddress);
  }

  /** Stops sales now and schedules the draw with the entries collected so far. */
  @Post('sessions/:id/close')
  @HttpCode(200)
  close(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sessions.closeEarly(admin.id, id, requestMeta(req).ipAddress);
  }

  @Post('sessions/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: z.output<typeof reasonSchema>,
    @Req() req: Request,
  ) {
    return this.sessions.cancel(admin.id, id, body.reason, requestMeta(req).ipAddress);
  }

  /** Runs a draw whose time has passed but which failed or was missed. */
  @Post('sessions/:id/draw/retry')
  @HttpCode(200)
  retryDraw(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sessions.retryDraw(admin.id, id, requestMeta(req).ipAddress);
  }

  @Get('sessions/:id/entries')
  entries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(entriesQuerySchema)) query: EntryListQuery,
  ): Promise<Paginated<AdminEntry>> {
    return this.sessions.entries(id, query);
  }
}
