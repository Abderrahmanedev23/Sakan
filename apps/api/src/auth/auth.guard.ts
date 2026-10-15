import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@sakan/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthenticatedRequest } from './auth.decorators.js';
import { hashSessionToken } from './session-token.js';

/**
 * Global guard. Every route needs a valid `Authorization: Bearer <token>` unless marked
 * @Public(), and @Roles() further restricts it. Sessions are looked up on each request so
 * logout and suspension take effect immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Sign in first');

    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { select: { id: true, role: true, accountStatus: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Your session has expired, sign in again');
    }
    if (session.user.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException('This account is suspended');
    }
    req.user = { id: session.user.id, role: session.user.role, sessionId: session.id };

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(session.user.role)) throw new ForbiddenException('Admins only');
    return true;
  }
}
