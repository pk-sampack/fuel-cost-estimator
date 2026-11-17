import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { clientIp } from './device';
import { AppError, errorCodes } from './errors';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  scope?: 'device' | 'ip' | 'device+ip';
}

export const RATE_LIMIT_KEY = 'fce:rate-limit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly daily = new Map<string, number>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    if (typeof this.sweeper.unref === 'function') this.sweeper.unref();
  }

  hit(key: string, limit: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (current.count >= limit) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  consumeDaily(key: string, limit: number): { allowed: boolean; used: number } {
    const used = this.daily.get(key) ?? 0;
    if (used >= limit) return { allowed: false, used };
    this.daily.set(key, used + 1);
    return { allowed: true, used: used + 1 };
  }

  reset(): void {
    this.buckets.clear();
    this.daily.clear();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request & { device?: { deviceId: string } }>();
    const scope = options.scope ?? 'device';
    const parts: string[] = [];
    if (scope === 'device' || scope === 'device+ip') parts.push(request.device?.deviceId ?? 'no-device');
    if (scope === 'ip' || scope === 'device+ip') parts.push(`ip:${clientIp(request)}`);
    const key = `${context.getClass().name}:${context.getHandler().name}:${parts.join('|')}`;

    const result = this.limiter.hit(key, options.limit, options.windowMs);
    if (!result.allowed) {
      throw new AppError(errorCodes.rateLimited, 'Too many requests, please slow down', 429, {
        retryAfterSec: result.retryAfterSec,
      });
    }
    return true;
  }
}
