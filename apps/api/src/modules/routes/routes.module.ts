import { Module } from '@nestjs/common';
import { DeviceGuard } from '../../common/device';
import { RateLimitGuard } from '../../common/rate-limit';
import { CatalogModule } from '../catalog/catalog.module';
import { MapsModule } from '../maps/maps.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [CatalogModule, MapsModule],
  controllers: [RoutesController],
  providers: [RoutesService, DeviceGuard, RateLimitGuard],
})
export class RoutesModule {}
