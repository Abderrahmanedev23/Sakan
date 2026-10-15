import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@sakan/shared';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Routes are private by default; mark the ones anyone can call. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route or controller to the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** The user resolved from the bearer token by AuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
