import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EngineValidationError } from '@fce/engine';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, errorCodes } from './errors';
import { captureException } from './sentry';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    const body = this.toBody(exception);
    const status = this.statusFor(exception);

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.path} -> ${status}`, exception instanceof Error ? exception.stack : undefined);
      captureException(exception);
    } else {
      this.logger.warn(`${request.method} ${request.path} -> ${status} ${body.error.code}`);
    }

    response.status(status).json(body);
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof AppError) return exception.status;
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof EngineValidationError) return HttpStatus.BAD_REQUEST;
    if (exception instanceof ZodError) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof AppError) {
      return { error: { code: exception.code, message: exception.message, details: exception.details } };
    }
    if (exception instanceof EngineValidationError) {
      return { error: { code: errorCodes.validation, message: exception.message, details: { field: exception.field } } };
    }
    if (exception instanceof ZodError) {
      return { error: { code: errorCodes.validation, message: 'Request validation failed', details: exception.flatten() } };
    }
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response !== null && 'message' in response
            ? String((response as { message: unknown }).message)
            : exception.message;
      return { error: { code: 'http_error', message } };
    }
    return { error: { code: errorCodes.internal, message: 'Something went wrong on our side' } };
  }
}
