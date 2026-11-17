import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { PlacesResponse, VehicleTypesResponse } from '@fce/contracts';
import { DeviceGuard } from '../../common/device';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit';
import { parseInput } from '../../common/validate';
import { CatalogService } from './catalog.service';
import { MapsService } from '../maps/maps.service';

const placesQuerySchema = z.object({ q: z.string().max(120).default('') });

@Controller()
@UseGuards(DeviceGuard, RateLimitGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly maps: MapsService,
  ) {}

  @Get('vehicle-types')
  @RateLimit({ limit: 120, windowMs: 60_000, scope: 'device+ip' })
  async vehicleTypes(): Promise<VehicleTypesResponse> {
    return { vehicleTypes: await this.catalog.listVehicleTypes() };
  }

  @Get('fuel-prices/current')
  @RateLimit({ limit: 120, windowMs: 60_000, scope: 'device+ip' })
  async currentPrices() {
    return this.catalog.currentPrices();
  }

  @Get('places')
  @RateLimit({ limit: 60, windowMs: 60_000, scope: 'device+ip' })
  async places(@Query() query: unknown): Promise<PlacesResponse> {
    const { q } = parseInput(placesQuerySchema, query);
    return { places: await this.maps.places(q) };
  }
}
