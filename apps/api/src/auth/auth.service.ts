import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthResponse, loginSchema, registerSchema } from '@sakan/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserProfile, userProfileInclude } from '../users/user-profile.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

interface ClientMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly sessionTtlMs: number;
  /** Compared against when the email is unknown, so both cases take the same time. */
  private readonly dummyHash = hashPassword('timing-equaliser');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.sessionTtlMs = Number(config.get('AUTH_SESSION_TTL_DAYS', 30)) * 24 * 60 * 60 * 1000;
  }

  async register(input: z.output<typeof registerSchema>, meta: ClientMeta): Promise<AuthResponse> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, phone: input.phone ?? null, passwordHash },
        });
        await this.audit.log(
          { actorId: user.id, action: 'user.registered', entityType: 'User', entityId: user.id, ipAddress: meta.ipAddress },
          tx,
        );
        return this.startSession(user.id, meta, tx);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = JSON.stringify(err.meta ?? {});
        throw new ConflictException(
          target.includes('phone') ? 'This phone number is already registered' : 'This email is already registered',
        );
      }
      throw err;
    }
  }

  async login(input: z.output<typeof loginSchema>, meta: ClientMeta): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) {
      await this.audit.log({
        actorId: user?.id ?? null,
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user?.id ?? null,
        metadata: { email: input.email },
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedException('Wrong email or password');
    }
    if (user.accountStatus !== 'ACTIVE') throw new ForbiddenException('This account is suspended');

    return this.prisma.$transaction(async (tx) => {
      await this.audit.log(
        { actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ipAddress: meta.ipAddress },
        tx,
      );
      return this.startSession(user.id, meta, tx);
    });
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async startSession(userId: string, meta: ClientMeta, tx: Prisma.TransactionClient): Promise<AuthResponse> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    await tx.authSession.create({
      data: { userId, tokenHash: hashSessionToken(token), expiresAt, ...meta },
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude });
    return { token, expiresAt: expiresAt.toISOString(), user: toUserProfile(user) };
  }
}
