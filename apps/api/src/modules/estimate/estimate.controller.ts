import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { estimateRequestSchema, type EstimateResponse } from '@fce/contracts';
import { DeviceGuard } from '../../common/device';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit';
import { parseInput } from '../../common/validate';
import { EstimateService } from './estimate.service';

@Controller('estimate')
@UseGuards(DeviceGuard, RateLimitGuard)
export class EstimateController {
  constructor(private readonly estimates: EstimateService) {}

  @Post()
  @RateLimit({ limit: 60, windowMs: 60_000, scope: 'device+ip' })
  async estimate(@Body() body: unknown): Promise<EstimateResponse> {
    return this.estimates.estimate(parseInput(estimateRequestSchema, body));
  }
}
