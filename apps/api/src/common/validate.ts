import type { z, ZodTypeAny } from 'zod';
import { AppError, errorCodes } from './errors';

export function parseInput<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(errorCodes.validation, 'Request validation failed', 400, parsed.error.flatten());
  }
  return parsed.data as z.infer<S>;
}
