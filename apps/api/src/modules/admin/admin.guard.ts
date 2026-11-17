import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError, errorCodes } from '../../common/errors';
import type { AdminClaims } from './auth.service';

export const PUBLIC_ROUTE = 'fce:public-route';
export const MFA_PENDING_ROUTE = 'fce:mfa-pending-route';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const AllowMfaPending = () => SetMetadata(MFA_PENDING_ROUTE, true);

export interface AdminContext {
  claims: AdminClaims;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { admin?: AdminContext }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(errorCodes.unauthorized, 'Sign in required', 401);
    }
    let claims: AdminClaims;
    try {
      claims = await this.jwt.verifyAsync<AdminClaims>(header.slice(7));
    } catch {
      throw new AppError(errorCodes.unauthorized, 'Session expired, sign in again', 401);
    }
    request.admin = { claims };

    const allowPending = this.reflector.getAllAndOverride<boolean>(MFA_PENDING_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!claims.mfa && !allowPending) {
      throw new AppError(errorCodes.mfaRequired, 'Enable two-factor authentication to continue', 403);
    }
    return true;
  }
}

export const Admin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminContext => {
  const request = context.switchToHttp().getRequest<Request & { admin?: AdminContext }>();
  if (!request.admin) throw new AppError(errorCodes.unauthorized, 'Sign in required', 401);
  return request.admin;
});
