import * as Sentry from '@sentry/node';
import { config } from '../config';

export function initSentry(): void {
  if (!config.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    release: 'fce-api@1.0.0',
    tracesSampleRate: 0.1,
  });
}

export function captureException(error: unknown): void {
  if (!config.sentryDsn) return;
  Sentry.captureException(error);
}
