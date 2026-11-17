import { MiddlewareConsumer, Module, type DynamicModule, type NestModule } from '@nestjs/common';
import type { SqlClient } from './db/client';
import { InfraModule } from './common/infra.module';
import { RequestLogMiddleware } from './common/logging.middleware';
import { MapsModule } from './modules/maps/maps.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { RoutesModule } from './modules/routes/routes.module';
import { EstimateModule } from './modules/estimate/estimate.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

@Module({})
export class AppModule implements NestModule {
  static forRoot(sql: SqlClient): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfraModule.forRoot(sql),
        MapsModule,
        CatalogModule,
        RoutesModule,
        EstimateModule,
        AdminModule,
        HealthModule,
      ],
      providers: [RequestLogMiddleware],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
