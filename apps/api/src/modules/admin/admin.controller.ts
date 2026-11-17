import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  adminFuelPriceInputSchema,
  adminLoginRequestSchema,
  adminVehicleTypePatchSchema,
  type AdminLoginResponse,
} from '@fce/contracts';
import { RateLimit, RateLimitGuard, RateLimitService } from '../../common/rate-limit';
import { parseInput } from '../../common/validate';
import { AdminAuthService } from './auth.service';
import { AdminDataService } from './admin-data.service';
import { Admin, AdminGuard, AllowMfaPending, type AdminContext } from './admin.guard';
import { AuditService } from './audit.service';
import { FuelSyncService } from './fuel-sync.service';

const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
const auditQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });

@Controller('admin/auth')
@UseGuards(RateLimitGuard)
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @RateLimit({ limit: 5, windowMs: 15 * 60_000, scope: 'ip' })
  async login(@Body() body: unknown): Promise<AdminLoginResponse> {
    const input = parseInput(adminLoginRequestSchema, body);
    return this.auth.login(input.email, input.password, input.totp);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly data: AdminDataService,
    private readonly audit: AuditService,
    private readonly fuelSync: FuelSyncService,
  ) {}

  @Get('auth/me')
  me(@Admin() admin: AdminContext) {
    return { email: admin.claims.email, role: admin.claims.role, mfaEnabled: admin.claims.mfa };
  }

  @Post('auth/mfa/setup')
  @AllowMfaPending()
  async setupMfa(@Admin() admin: AdminContext) {
    return this.auth.startMfaSetup(admin.claims.email);
  }

  @Post('auth/mfa/verify')
  @AllowMfaPending()
  async verifyMfa(@Body() body: unknown, @Admin() admin: AdminContext) {
    const { code } = parseInput(mfaCodeSchema, body);
    return this.auth.confirmMfa(admin.claims.email, code);
  }

  @Get('fuel-prices')
  async fuelPrices() {
    return { items: await this.data.listFuelPrices() };
  }

  @Post('fuel-prices')
  async createFuelPrice(@Body() body: unknown, @Admin() admin: AdminContext) {
    const input = parseInput(adminFuelPriceInputSchema, body);
    return this.data.createFuelPrice(input, admin.claims.email);
  }

  @Post('fuel-prices/sync')
  async syncFuelPrices(@Admin() admin: AdminContext) {
    return this.fuelSync.syncNow(admin.claims.email);
  }

  @Patch('fuel-prices/:id')
  async patchFuelPrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Admin() admin: AdminContext,
  ) {
    const input = parseInput(adminFuelPriceInputSchema.partial(), body);
    return this.data.patchFuelPrice(id, input, admin.claims.email);
  }

  @Post('fuel-prices/:id/approve')
  async approveFuelPrice(@Param('id', ParseIntPipe) id: number, @Admin() admin: AdminContext) {
    return this.data.approveFuelPrice(id, admin.claims.email);
  }

  @Delete('fuel-prices/:id')
  async deleteFuelPrice(@Param('id', ParseIntPipe) id: number, @Admin() admin: AdminContext) {
    return this.data.deleteFuelPrice(id, admin.claims.email);
  }

  @Get('vehicle-types')
  async vehicleTypes() {
    return { items: await this.data.listVehicleTypes() };
  }

  @Patch('vehicle-types/:code')
  async patchVehicleType(
    @Param('code') code: string,
    @Body() body: unknown,
    @Admin() admin: AdminContext,
  ) {
    const patch = parseInput(adminVehicleTypePatchSchema, body);
    return this.data.patchVehicleType(code, patch, admin.claims.email);
  }

  @Get('audit')
  @RateLimit({ limit: 60, windowMs: 60_000, scope: 'ip' })
  async auditLog(@Query() query: unknown) {
    const { limit } = parseInput(auditQuerySchema, query);
    return { items: await this.audit.list(limit) };
  }
}
