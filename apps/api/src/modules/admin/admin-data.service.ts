import { Inject, Injectable } from '@nestjs/common';
import { AppError, errorCodes } from '../../common/errors';
import { toDateString, toIso } from '../../common/time';
import { SQL, type SqlClient } from '../../db/token';
import { CatalogService } from '../catalog/catalog.service';
import type { AdminFuelPriceInput, AdminVehicleTypePatch } from '@fce/contracts';
import { AuditService } from './audit.service';

interface FuelPriceRow {
  id: number;
  fuel_type: string;
  price_per_litre: string | number;
  effective_from: unknown;
  checked_at: unknown;
  source: string;
  status: 'draft' | 'approved';
  approved_by: string | null;
  approved_at: unknown | null;
}

export type FuelPriceImportAction = 'inserted' | 'updated' | 'unchanged' | 'skipped';

export interface FuelPriceImportOutcome {
  action: FuelPriceImportAction;
  reason?: string;
}

interface VehicleTypeRow {
  id: number;
  code: string;
  name_en: string;
  name_ur: string;
  class: string;
  picture_key: string;
  default_load_penalty_k: string | number;
  kmpl_min: string | number;
  kmpl_max: string | number;
  seats: number | null;
  payload_tons: string | number | null;
  sort_order: number;
  active: boolean;
  updated_at: unknown;
}

@Injectable()
export class AdminDataService {
  constructor(
    @Inject(SQL) private readonly sql: SqlClient,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
  ) {}

  async listFuelPrices(): Promise<unknown[]> {
    const result = await this.sql.query<FuelPriceRow>(
      `SELECT id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at
         FROM fuel_prices
        ORDER BY effective_from DESC, fuel_type ASC`,
    );
    return result.rows.map(mapFuelPrice);
  }

  async createFuelPrice(input: AdminFuelPriceInput, actor: string): Promise<unknown> {
    const result = await this.sql.query<FuelPriceRow>(
      `INSERT INTO fuel_prices (fuel_type, price_per_litre, effective_from, checked_at, source, status)
       VALUES ($1, $2, $3, NOW(), $4, 'draft')
       ON CONFLICT (fuel_type, effective_from) DO NOTHING
       RETURNING id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at`,
      [input.fuelType, input.pricePerLitre, input.effectiveFrom, input.source],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(errorCodes.conflict, 'A price for that fuel type and date already exists', 409);
    }
    await this.audit.record(actor, 'fuel_price.create', 'fuel_price', String(row.id), null, mapFuelPrice(row));
    return mapFuelPrice(row);
  }

  async patchFuelPrice(
    id: number,
    patch: Partial<AdminFuelPriceInput>,
    actor: string,
  ): Promise<unknown> {
    const before = await this.getFuelPrice(id);
    if (before.status === 'approved') {
      throw new AppError(errorCodes.conflict, 'Approved prices cannot be edited; add a new effective date', 409);
    }
    const result = await this.sql.query<FuelPriceRow>(
      `UPDATE fuel_prices
          SET price_per_litre = COALESCE($2, price_per_litre),
              effective_from = COALESCE($3::date, effective_from),
              source = COALESCE($4, source),
              checked_at = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at`,
      [id, patch.pricePerLitre ?? null, patch.effectiveFrom ?? null, patch.source ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(errorCodes.notFound, 'Draft price not found', 404);
    await this.audit.record(actor, 'fuel_price.update', 'fuel_price', String(id), mapFuelPrice(before), mapFuelPrice(row));
    return mapFuelPrice(row);
  }

  async approveFuelPrice(id: number, actor: string): Promise<unknown> {
    const before = await this.getFuelPrice(id);
    const result = await this.sql.query<FuelPriceRow>(
      `UPDATE fuel_prices
          SET status = 'approved', approved_by = $2, approved_at = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at`,
      [id, actor],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(errorCodes.conflict, 'Only draft prices can be approved', 409);
    this.catalog.invalidatePrices();
    await this.audit.record(actor, 'fuel_price.approve', 'fuel_price', String(id), mapFuelPrice(before), mapFuelPrice(row));
    return mapFuelPrice(row);
  }

  async importFuelPrice(input: AdminFuelPriceInput, actor: string): Promise<FuelPriceImportOutcome> {
    const existing = await this.sql.query<FuelPriceRow>(
      `SELECT id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at
         FROM fuel_prices
        WHERE fuel_type = $1 AND effective_from = $2::date
        LIMIT 1`,
      [input.fuelType, input.effectiveFrom],
    );
    const row = existing.rows[0];

    if (!row) {
      const latest = await this.sql.query<{ effective_from: unknown }>(
        `SELECT effective_from
           FROM fuel_prices
          WHERE fuel_type = $1 AND status = 'approved'
          ORDER BY effective_from DESC
          LIMIT 1`,
        [input.fuelType],
      );
      const latestDate = latest.rows[0] ? toDateString(latest.rows[0].effective_from) : null;
      if (latestDate && input.effectiveFrom < latestDate) {
        return { action: 'skipped', reason: 'older than the latest approved price' };
      }

      const inserted = await this.sql.query<FuelPriceRow>(
        `INSERT INTO fuel_prices
           (fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at)
         VALUES ($1, $2, $3, NOW(), $4, 'approved', $5, NOW())
         ON CONFLICT (fuel_type, effective_from) DO NOTHING
         RETURNING id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at`,
        [input.fuelType, input.pricePerLitre, input.effectiveFrom, input.source, actor],
      );
      const created = inserted.rows[0];
      if (!created) {
        return { action: 'skipped', reason: 'a price for that date already exists' };
      }
      this.catalog.invalidatePrices();
      await this.audit.record(
        actor,
        'fuel_price.sync_import',
        'fuel_price',
        String(created.id),
        null,
        mapFuelPrice(created),
      );
      return { action: 'inserted' };
    }

    if (row.status !== 'approved') {
      return { action: 'skipped', reason: 'a draft for that date is waiting for review' };
    }

    const currentPrice = roundMoney(Number(row.price_per_litre));
    const incomingPrice = roundMoney(input.pricePerLitre);
    if (currentPrice === incomingPrice) {
      await this.sql.query('UPDATE fuel_prices SET checked_at = NOW() WHERE id = $1', [row.id]);
      this.catalog.invalidatePrices();
      return { action: 'unchanged' };
    }

    const updated = await this.sql.query<FuelPriceRow>(
      `UPDATE fuel_prices
          SET price_per_litre = $2,
              source = $3,
              checked_at = NOW(),
              approved_by = $4,
              approved_at = NOW()
        WHERE id = $1 AND status = 'approved'
        RETURNING id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at`,
      [row.id, input.pricePerLitre, input.source, actor],
    );
    const next = updated.rows[0];
    if (!next) {
      return { action: 'skipped', reason: 'the price changed while syncing' };
    }
    this.catalog.invalidatePrices();
    await this.audit.record(
      actor,
      'fuel_price.sync_update',
      'fuel_price',
      String(row.id),
      mapFuelPrice(row),
      mapFuelPrice(next),
    );
    return { action: 'updated' };
  }

  async deleteFuelPrice(id: number, actor: string): Promise<{ id: number }> {
    const before = await this.getFuelPrice(id);
    if (before.status !== 'draft') {
      throw new AppError(errorCodes.conflict, 'Approved prices cannot be deleted', 409);
    }
    const result = await this.sql.query<{ id: number }>(
      `DELETE FROM fuel_prices WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(errorCodes.notFound, 'Draft price not found', 404);
    await this.audit.record(actor, 'fuel_price.delete', 'fuel_price', String(id), mapFuelPrice(before), null);
    return { id: Number(row.id) };
  }

  async listVehicleTypes(): Promise<unknown[]> {
    const result = await this.sql.query<VehicleTypeRow>(
      `SELECT id, code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, seats, payload_tons, sort_order, active, updated_at
         FROM vehicle_types
        ORDER BY sort_order, code`,
    );
    return result.rows.map(mapVehicleType);
  }

  async patchVehicleType(code: string, patch: AdminVehicleTypePatch, actor: string): Promise<unknown> {
    const beforeResult = await this.sql.query<VehicleTypeRow>(
      `SELECT id, code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, seats, payload_tons, sort_order, active, updated_at
         FROM vehicle_types WHERE code = $1`,
      [code],
    );
    const before = beforeResult.rows[0];
    if (!before) throw new AppError(errorCodes.notFound, 'Vehicle type not found', 404);

    const result = await this.sql.query<VehicleTypeRow>(
      `UPDATE vehicle_types
          SET name_en = COALESCE($2, name_en),
              name_ur = COALESCE($3, name_ur),
              default_load_penalty_k = COALESCE($4, default_load_penalty_k),
              kmpl_min = COALESCE($5, kmpl_min),
              kmpl_max = COALESCE($6, kmpl_max),
              active = COALESCE($7, active),
              sort_order = COALESCE($8, sort_order),
              seats = $9,
              payload_tons = $10,
              updated_at = NOW()
        WHERE code = $1
        RETURNING id, code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, seats, payload_tons, sort_order, active, updated_at`,
      [
        code,
        patch.nameEn ?? null,
        patch.nameUr ?? null,
        patch.defaultLoadPenaltyK ?? null,
        patch.kmplMin ?? null,
        patch.kmplMax ?? null,
        patch.active ?? null,
        patch.sortOrder ?? null,
        patch.seats !== undefined ? patch.seats : before.seats,
        patch.payloadTons !== undefined ? patch.payloadTons : before.payload_tons,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(errorCodes.notFound, 'Vehicle type not found', 404);
    await this.audit.record(actor, 'vehicle_type.update', 'vehicle_type', code, mapVehicleType(before), mapVehicleType(row));
    return mapVehicleType(row);
  }

  private async getFuelPrice(id: number): Promise<FuelPriceRow> {
    const result = await this.sql.query<FuelPriceRow>(
      `SELECT id, fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at
         FROM fuel_prices WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(errorCodes.notFound, 'Fuel price not found', 404);
    return row;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapFuelPrice(row: FuelPriceRow) {
  return {
    id: Number(row.id),
    fuelType: row.fuel_type,
    pricePerLitre: Number(row.price_per_litre),
    effectiveFrom: toDateString(row.effective_from),
    checkedAt: toIso(row.checked_at),
    source: row.source,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? toIso(row.approved_at) : null,
  };
}

function mapVehicleType(row: VehicleTypeRow) {
  return {
    id: Number(row.id),
    code: row.code,
    nameEn: row.name_en,
    nameUr: row.name_ur,
    class: row.class,
    pictureKey: row.picture_key,
    defaultLoadPenaltyK: Number(row.default_load_penalty_k),
    kmplMin: Number(row.kmpl_min),
    kmplMax: Number(row.kmpl_max),
    seats: row.seats === null ? null : Number(row.seats),
    payloadTons: row.payload_tons === null ? null : Number(row.payload_tons),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
    updatedAt: toIso(row.updated_at),
  };
}
