import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../../config';
import { DeviceGuard } from '../../common/device';
import { RateLimitGuard } from '../../common/rate-limit';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminAuthController, AdminController } from './admin.controller';
import { AdminDataService } from './admin-data.service';
import { AdminGuard } from './admin.guard';
import { AdminAuthService } from './auth.service';
import { AuditService } from './audit.service';
import { FuelSyncService } from './fuel-sync.service';
import { FuelRefreshController } from './fuel-refresh.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
    CatalogModule,
  ],
  controllers: [AdminAuthController, AdminController, FuelRefreshController],
  providers: [
    AdminAuthService,
    AdminDataService,
    AuditService,
    FuelSyncService,
    AdminGuard,
    DeviceGuard,
    RateLimitGuard,
  ],
  exports: [AdminAuthService, AuditService],
})
export class AdminModule {}
