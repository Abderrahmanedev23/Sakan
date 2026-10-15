import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  AccountStatus,
  rejectVerificationSchema,
  suspendUserSchema,
  VerificationStatus,
  type AdminUserDetail,
  type AdminUserSummary,
  type Paginated,
} from '@sakan/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { requestMeta } from '../common/request-meta.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminUsersService, type UserListQuery } from './admin-users.service.js';

const listQuerySchema = z.object({
  verificationStatus: z.enum(Object.values(VerificationStatus)).optional(),
  accountStatus: z.enum(Object.values(AccountStatus)).optional(),
  q: z.string().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('admin')
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  /** ?verificationStatus=PENDING gives the review queue, oldest first. */
  @Get('users')
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: UserListQuery): Promise<Paginated<AdminUserSummary>> {
    return this.users.list(query);
  }

  @Get('users/:id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Post('users/:id/verification/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.users.approve(admin.id, id, requestMeta(req).ipAddress);
  }

  @Post('users/:id/verification/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectVerificationSchema)) body: z.output<typeof rejectVerificationSchema>,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.users.reject(admin.id, id, body.reason, requestMeta(req).ipAddress);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  suspend(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(suspendUserSchema)) body: z.output<typeof suspendUserSchema>,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.users.setAccountStatus(admin.id, id, 'SUSPENDED', body.reason, requestMeta(req).ipAddress);
  }

  @Post('users/:id/reactivate')
  @HttpCode(200)
  reactivate(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.users.setAccountStatus(admin.id, id, 'ACTIVE', null, requestMeta(req).ipAddress);
  }

  /** The CIN image itself. Clients fetch it with the bearer token and display the blob. */
  @Get('identity-documents/:id/file')
  async document(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const file = await this.users.openDocument(admin.id, id, requestMeta(req).ipAddress);
    req.res?.setHeader('Cache-Control', 'private, no-store');
    req.res?.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.sizeBytes,
      disposition: 'inline',
    });
  }
}
