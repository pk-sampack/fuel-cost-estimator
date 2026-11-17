import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { SqlClient } from '../db/client';
import { SQL } from '../db/token';
import { DeviceGuard } from '../common/device';
import { RateLimitGuard, RateLimitService } from '../common/rate-limit';

@Global()
@Module({})
export class InfraModule {
  static forRoot(sql: SqlClient): DynamicModule {
    return {
      global: true,
      module: InfraModule,
      providers: [
        { provide: SQL, useValue: sql },
        RateLimitService,
        DeviceGuard,
        RateLimitGuard,
      ],
      exports: [SQL, RateLimitService, DeviceGuard, RateLimitGuard],
    };
  }
}
