import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { clientIp } from './device';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(request: Request & { device?: { deviceId: string } }, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = {
        t: new Date().toISOString(),
        level: response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info',
        msg: 'http',
        method: request.method,
        path: request.path,
        status: response.statusCode,
        ms: Math.round(durationMs),
        ipHash: shortHash(clientIp(request)),
        deviceHash: request.device ? request.device.deviceId.slice(0, 12) : null,
      };
      process.stdout.write(`${JSON.stringify(line)}\n`);
    });
    next();
  }
}

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
