import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { AppError, errorCodes } from './errors';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const DEVICE_HEADER = 'x-device-token';

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(`device:${token}`).digest('hex');
}

export interface DeviceContext {
  deviceId: string;
}

export function readDeviceToken(request: Request): string | null {
  const raw = request.headers[DEVICE_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token) return null;
  const trimmed = token.trim();
  return TOKEN_PATTERN.test(trimmed) ? trimmed : '';
}

export function clientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first) return first.split(',')[0]?.trim() || 'unknown';
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

@Injectable()
export class DeviceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { device?: DeviceContext }>();
    const token = readDeviceToken(request);
    if (token === null) {
      throw new AppError(errorCodes.deviceMissing, 'Device token header is required', 400);
    }
    if (token === '') {
      throw new AppError(errorCodes.deviceInvalid, 'Device token format is invalid', 400);
    }
    request.device = { deviceId: hashDeviceToken(token) };
    return true;
  }
}

export const Device = createParamDecorator((_data: unknown, context: ExecutionContext): DeviceContext => {
  const request = context.switchToHttp().getRequest<Request & { device?: DeviceContext }>();
  if (!request.device) throw new AppError(errorCodes.deviceMissing, 'Device token missing', 400);
  return request.device;
});
