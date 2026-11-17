import { Module } from '@nestjs/common';
import { DeviceGuard } from '../../common/device';
import { RateLimitGuard } from '../../common/rate-limit';
import { CatalogModule } from '../catalog/catalog.module';
import { EstimateController } from './estimate.controller';
import { EstimateService } from './estimate.service';

@Module({
  imports: [CatalogModule],
  controllers: [EstimateController],
  providers: [EstimateService, DeviceGuard, RateLimitGuard],
})
export class EstimateModule {}
