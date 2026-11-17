import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { initSentry } from './common/sentry';
import { ApiExceptionFilter } from './common/exception.filter';
import { createSqlClient } from './db/client';
import { runMigrations } from './db/migrator';

async function bootstrap(): Promise<void> {
  initSentry();

  const sql = await createSqlClient(config);
  const report = await runMigrations(sql, { logger: (line) => console.log(line) });
  if (report.applied.length > 0) {
    console.log(`database ready: ${report.applied.length} migration(s) applied`);
  }

  const app = await NestFactory.create(AppModule.forRoot(sql), {
    logger: config.nodeEnv === 'test' ? false : ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('v1');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.enableCors({ origin: config.origins, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  console.log(`fce-api listening on :${config.port} (${config.nodeEnv}, ${config.dbDriver})`);

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing`);
    await app.close();
    await sql.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('fatal startup error', error);
  process.exit(1);
});
