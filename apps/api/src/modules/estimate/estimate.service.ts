import { Inject, Injectable } from '@nestjs/common';
import { calculateEstimate } from '@fce/engine';
import type { EstimateRequest, EstimateResponse } from '@fce/contracts';
import { AppError, errorCodes } from '../../common/errors';
import { SQL, type SqlClient } from '../../db/token';
import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class EstimateService {
  constructor(
    @Inject(SQL) private readonly sql: SqlClient,
    private readonly catalog: CatalogService,
  ) {}

  async estimate(request: EstimateRequest): Promise<EstimateResponse> {
    const vehicleType = await this.catalog.getVehicleType(request.vehicleTypeCode);
    if (!vehicleType) {
      throw new AppError(errorCodes.notFound, 'Vehicle type is not available', 404, {
        vehicleTypeCode: request.vehicleTypeCode,
      });
    }

    const fuelPrice = await this.catalog.currentPrice(request.fuelType);
    if (!fuelPrice) {
      throw new AppError(errorCodes.notFound, 'No approved fuel price is available for this fuel type', 404, {
        fuelType: request.fuelType,
      });
    }

    const warnings: string[] = [];
    if (request.kmpl < vehicleType.kmplMin || request.kmpl > vehicleType.kmplMax) {
      warnings.push('kmpl_outside_typical_range');
    }
    if (vehicleType.class === 'passenger' && request.kmplFull) {
      warnings.push('kmpl_full_ignored');
    }
    if (fuelPrice.stale) warnings.push('fuel_price_stale');
    if (fuelPrice.source.startsWith('seed')) warnings.push('fuel_price_placeholder');

    const result = calculateEstimate({
      vehicleClass: vehicleType.class,
      distanceKm: request.distanceKm,
      fuelPricePerLitre: fuelPrice.pricePerLitre,
      kmpl: request.kmpl,
      kmplFull: request.kmplFull ?? null,
      loadRatio: request.loadRatio,
      defaultLoadPenaltyK: vehicleType.defaultLoadPenaltyK,
      tolls: request.tolls,
      returnEmpty: request.returnEmpty,
    });

    return {
      calcVersion: result.calcVersion,
      legs: result.legs,
      fuelLitresTotal: result.fuelLitresTotal,
      fuelCostTotal: result.fuelCostTotal,
      tolls: result.tolls,
      total: result.total,
      k: result.k,
      kSource: result.kSource,
      fuelPrice,
      vehicleType: {
        code: vehicleType.code,
        nameEn: vehicleType.nameEn,
        nameUr: vehicleType.nameUr,
        class: vehicleType.class,
      },
      warnings,
    };
  }
}
