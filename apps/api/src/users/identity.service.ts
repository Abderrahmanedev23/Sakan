import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IDENTITY_DOCUMENT_MAX_BYTES, type identitySchema, type UserProfile } from '@sakan/shared';
import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectImageType, IMAGE_EXTENSIONS } from '../storage/file-type.js';
import { StorageService } from '../storage/storage.service.js';
import { toUserProfile, userProfileInclude } from './user-profile.js';

export interface IdentityScans {
  front?: Express.Multer.File;
  back?: Express.Multer.File;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userProfileInclude });
    if (!user) throw new NotFoundException('User not found');
    return toUserProfile(user);
  }

  /**
   * Saves CIN details and both scans and puts the account in the review queue.
   * Allowed for new accounts and after a rejection; not while a review is pending or once approved.
   */
  async submit(
    userId: string,
    input: z.output<typeof identitySchema>,
    scans: IdentityScans,
    ipAddress: string | null,
  ): Promise<UserProfile> {
    const files = (['FRONT', 'BACK'] as const).map((side) => {
      const file = side === 'FRONT' ? scans.front : scans.back;
      if (!file) throw new BadRequestException(`Upload the ${side.toLowerCase()} of your CIN`);
      if (file.size > IDENTITY_DOCUMENT_MAX_BYTES) throw new BadRequestException('Each image must be 5 MB or less');
      const mimeType = detectImageType(file.buffer);
      if (!mimeType) throw new BadRequestException(`The ${side.toLowerCase()} must be a JPEG, PNG or WebP photo`);
      return {
        side,
        mimeType,
        buffer: file.buffer,
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        storageKey: `identity/${userId}/${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`,
      };
    });

    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException('User not found');
    this.assertCanSubmit(current.verificationStatus);

    for (const file of files) await this.storage.put(file.storageKey, file.buffer);
    try {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        // The status condition makes concurrent submissions and admin decisions safe.
        const { count } = await tx.user.updateMany({
          where: { id: userId, verificationStatus: { in: ['UNSUBMITTED', 'REJECTED'] } },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            dateOfBirth: input.dateOfBirth,
            cinNumber: input.cinNumber,
            cinExpiresAt: input.cinExpiresAt,
            verificationStatus: 'PENDING',
            identitySubmittedAt: now,
            verifiedAt: null,
          },
        });
        if (count === 0) throw new ConflictException('Your identity is already under review');

        await tx.identityDocument.updateMany({ where: { userId, supersededAt: null }, data: { supersededAt: now } });
        await tx.identityDocument.createMany({
          data: files.map(({ side, mimeType, sizeBytes, sha256, storageKey }) => ({
            userId,
            side,
            mimeType,
            sizeBytes,
            sha256,
            storageKey,
          })),
        });
        await this.audit.log(
          {
            actorId: userId,
            action: 'identity.submitted',
            entityType: 'User',
            entityId: userId,
            metadata: { cinNumber: input.cinNumber, resubmission: current.verificationStatus === 'REJECTED' },
            ipAddress,
          },
          tx,
        );
      });
    } catch (err) {
      await Promise.all(files.map((file) => this.storage.delete(file.storageKey)));
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This CIN number is already linked to another account');
      }
      throw err;
    }
    return this.getProfile(userId);
  }

  private assertCanSubmit(status: string) {
    if (status === 'PENDING') throw new ConflictException('Your identity is already under review');
    if (status === 'APPROVED') throw new ConflictException('Your identity is already verified');
  }
}
