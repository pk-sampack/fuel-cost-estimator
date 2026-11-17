import { Inject, Injectable } from '@nestjs/common';
import type {
  CurrentFuelPricesResponse,
  FuelPriceDto,
  FuelType,
  VehicleTypeDto,
} from '@fce/contracts';
import { SQL, type SqlClient } from '../../db/token';
import { isOlderThan, toDateString, toIso, todayInPakistan } from '../../common/time';

interface VehicleTypeRow {
  code: string;
  name_en: string;
  name_ur: string;
  class: 'passenger' | 'goods';
  picture_key: string;
  default_load_penalty_k: string | number;
  kmpl_min: string | number;
  kmpl_max: string | number;
  load_options: unknown;
  seats: number | null;
  payload_tons: string | number | null;
  sort_order: number;
}

interface FuelPriceRow {
  fuel_type: FuelType;
  price_per_litre: string | number;
  effective_from: unknown;
  checked_at: unknown;
  source: string;
}

const FUEL_ORDER: FuelType[] = ['petrol', 'diesel', 'cng', 'lpg'];
const PRICE_CACHE_MS = 30_000;

@Injectable()
export class CatalogService {
  private priceCache: { at: number; data: CurrentFuelPricesResponse } | null = null;

  constructor(@Inject(SQL) private readonly sql: SqlClient) {}

  async listVehicleTypes(): Promise<VehicleTypeDto[]> {
    const result = await this.sql.query<VehicleTypeRow>(
      `SELECT code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, load_options, seats, payload_tons, sort_order
         FROM vehicle_types
        WHERE active = TRUE
        ORDER BY sort_order, code`,
    );
    return result.rows.map(mapVehicleType);
  }

  async getVehicleType(code: string): Promise<VehicleTypeDto | null> {
    const result = await this.sql.query<VehicleTypeRow>(
      `SELECT code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, load_options, seats, payload_tons, sort_order
         FROM vehicle_types
        WHERE code = $1 AND active = TRUE`,
      [code],
    );
    const row = result.rows[0];
    return row ? mapVehicleType(row) : null;
  }

  async currentPrices(now: Date = new Date()): Promise<CurrentFuelPricesResponse> {
    if (this.priceCache && now.getTime() - this.priceCache.at < PRICE_CACHE_MS) {
      return this.priceCache.data;
    }
    const threshold = await this.configNumber('stale_price_threshold_days', 2);
    const day = todayInPakistan(now);
    const result = await this.sql.query<FuelPriceRow>(
      `SELECT DISTINCT ON (fuel_type) fuel_type, price_per_litre, effective_from, checked_at, source
         FROM fuel_prices
        WHERE status = 'approved' AND effective_from <= $1
        ORDER BY fuel_type, effective_from DESC`,
      [day],
    );

    const prices = result.rows
      .map((row) => this.mapPrice(row, threshold, now))
      .sort((a, b) => FUEL_ORDER.indexOf(a.fuelType) - FUEL_ORDER.indexOf(b.fuelType));

    const data: CurrentFuelPricesResponse = {
      prices,
      stalePriceThresholdDays: threshold,
      serverDate: day,
    };
    this.priceCache = { at: now.getTime(), data };
    return data;
  }

  async currentPrice(fuelType: FuelType, now: Date = new Date()): Promise<FuelPriceDto | null> {
    const current = await this.currentPrices(now);
    return current.prices.find((price) => price.fuelType === fuelType) ?? null;
  }

  async configNumber(key: string, fallback: number): Promise<number> {
    const result = await this.sql.query<{ value: unknown }>('SELECT value FROM app_config WHERE key = $1', [key]);
    const value = result.rows[0]?.value;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  invalidatePrices(): void {
    this.priceCache = null;
  }

  private mapPrice(row: FuelPriceRow, threshold: number, now: Date): FuelPriceDto {
    return {
      fuelType: row.fuel_type,
      pricePerLitre: round2(Number(row.price_per_litre)),
      effectiveFrom: toDateString(row.effective_from),
      checkedAt: toIso(row.checked_at),
      source: row.source,
      stale: isOlderThan(row.checked_at, threshold, now),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapVehicleType(row: VehicleTypeRow): VehicleTypeDto {
  const options = Array.isArray(row.load_options) ? row.load_options : [0];
  return {
    code: row.code,
    nameEn: row.name_en,
    nameUr: row.name_ur,
    class: row.class,
    pictureKey: row.picture_key,
    defaultLoadPenaltyK: Number(row.default_load_penalty_k),
    kmplMin: Number(row.kmpl_min),
    kmplMax: Number(row.kmpl_max),
    loadOptions: options.filter((value): value is 0 | 0.5 | 1 => value === 0 || value === 0.5 || value === 1),
    seats: row.seats === null ? null : Number(row.seats),
    payloadTons: row.payload_tons === null ? null : Number(row.payload_tons),
    sortOrder: Number(row.sort_order),
  };
}
