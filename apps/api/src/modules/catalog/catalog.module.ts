import { Module } from '@nestjs/common';
import { DeviceGuard } from '../../common/device';
import { RateLimitGuard } from '../../common/rate-limit';
import { MapsModule } from '../maps/maps.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [MapsModule],
  controllers: [CatalogController],
  providers: [CatalogService, DeviceGuard, RateLimitGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
