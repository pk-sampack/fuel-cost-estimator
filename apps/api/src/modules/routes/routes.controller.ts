import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { routeEstimateRequestSchema, type RouteEstimateResponse } from '@fce/contracts';
import { Device, DeviceGuard, type DeviceContext } from '../../common/device';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit';
import { parseInput } from '../../common/validate';
import { RoutesService } from './routes.service';

@Controller('routes')
@UseGuards(DeviceGuard, RateLimitGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post('estimate')
  @RateLimit({ limit: 12, windowMs: 60_000, scope: 'device+ip' })
  async estimate(@Body() body: unknown, @Device() device: DeviceContext): Promise<RouteEstimateResponse> {
    const request = parseInput(routeEstimateRequestSchema, body);
    return this.routes.estimate(request, device.deviceId);
  }
}
