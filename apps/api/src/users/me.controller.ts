import { Body, Controller, Get, Put, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IDENTITY_DOCUMENT_MAX_BYTES, identitySchema, type UserProfile } from '@sakan/shared';
import type { Request } from 'express';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { requestMeta } from '../common/request-meta.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { IdentityService } from './identity.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  profile(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.identity.getProfile(user.id);
  }

  /**
   * multipart/form-data with the CIN fields (firstName, lastName, dateOfBirth,
   * cinNumber, cinExpiresAt) and two image files named `front` and `back`.
   */
  @Put('identity')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 },
      ],
      // Files are held in memory (at most 2 × 5 MB) and checked before anything is stored.
      { limits: { fileSize: IDENTITY_DOCUMENT_MAX_BYTES, files: 2, fields: 10 } },
    ),
  )
  submitIdentity(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(identitySchema)) body: z.output<typeof identitySchema>,
    @UploadedFiles() files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] } | undefined,
    @Req() req: Request,
  ): Promise<UserProfile> {
    return this.identity.submit(
      user.id,
      body,
      { front: files?.front?.[0], back: files?.back?.[0] },
      requestMeta(req).ipAddress,
    );
  }
}
