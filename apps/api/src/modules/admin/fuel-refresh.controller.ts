import { Controller, Post, UseGuards } from '@nestjs/common';
import type { FuelPricesRefreshResponse } from '@fce/contracts';
import { DeviceGuard } from '../../common/device';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit';
import { CatalogService } from '../catalog/catalog.service';
import { FuelSyncService } from './fuel-sync.service';

const MIN_SYNC_INTERVAL_MS = 30 * 60 * 1000;

@Controller()
@UseGuards(DeviceGuard, RateLimitGuard)
export class FuelRefreshController {
  constructor(
    private readonly sync: FuelSyncService,
    private readonly catalog: CatalogService,
  ) {}

  @Post('fuel-prices/refresh')
  @RateLimit({ limit: 6, windowMs: 60_000, scope: 'device+ip' })
  async refresh(): Promise<FuelPricesRefreshResponse> {
    const refreshed = await this.sync.refreshIfStale(MIN_SYNC_INTERVAL_MS);
    const current = await this.catalog.currentPrices();
    return { ...current, refreshed };
  }
}
