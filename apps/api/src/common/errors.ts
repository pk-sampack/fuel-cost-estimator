export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const errorCodes = {
  validation: 'validation_failed',
  deviceMissing: 'device_token_missing',
  deviceInvalid: 'device_token_invalid',
  rateLimited: 'rate_limited',
  quotaExceeded: 'daily_quota_exceeded',
  notFound: 'not_found',
  conflict: 'conflict',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  mfaRequired: 'mfa_required',
  mfaInvalid: 'mfa_invalid',
  internal: 'internal_error',
} as const;
